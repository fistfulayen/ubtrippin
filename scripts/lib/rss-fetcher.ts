import type { FeedItem } from './types'

interface ParsedFeedLike {
  items?: Array<Record<string, unknown>>
}

async function importOptionalModule(moduleName: string): Promise<unknown | null> {
  try {
    return await new Function(`return import(${JSON.stringify(moduleName)})`)()
  } catch {
    return null
  }
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function absolutizeUrl(baseUrl: string, maybeRelative: string): string {
  try {
    return new URL(maybeRelative, baseUrl).toString()
  } catch {
    return maybeRelative
  }
}

function matchFirst(value: string, pattern: RegExp): string | null {
  const match = value.match(pattern)
  return match?.[1]?.trim() ?? null
}

function parseXmlItems(xml: string): FeedItem[] {
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/(item|entry)>/gi) ?? []

  return blocks
    .map((block) => {
      const title = stripHtml(matchFirst(block, /<title[^>]*>([\s\S]*?)<\/title>/i) ?? '')
      if (!title) return null

      const link =
        matchFirst(block, /<link[^>]*href="([^"]+)"[^>]*\/?>/i) ??
        matchFirst(block, /<link[^>]*>([\s\S]*?)<\/link>/i)
      const summary =
        stripHtml(matchFirst(block, /<description[^>]*>([\s\S]*?)<\/description>/i) ?? '') ||
        stripHtml(matchFirst(block, /<summary[^>]*>([\s\S]*?)<\/summary>/i) ?? '') ||
        stripHtml(matchFirst(block, /<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i) ?? '')
      const content = stripHtml(matchFirst(block, /<content[^>]*>([\s\S]*?)<\/content>/i) ?? summary)
      const publishedAt =
        matchFirst(block, /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) ??
        matchFirst(block, /<published[^>]*>([\s\S]*?)<\/published>/i) ??
        matchFirst(block, /<updated[^>]*>([\s\S]*?)<\/updated>/i) ??
        null
      const imageUrl =
        matchFirst(block, /<media:content[^>]*url="([^"]+)"/i) ??
        matchFirst(block, /<enclosure[^>]*url="([^"]+)"/i)

      return {
        title,
        link,
        summary,
        content,
        publishedAt,
        imageUrl,
      } satisfies FeedItem
    })
    .filter((item): item is FeedItem => Boolean(item))
}

async function parseWithDependency(url: string): Promise<FeedItem[] | null> {
  try {
    const imported = await importOptionalModule('rss-parser')
    if (!imported || typeof imported !== 'object' || !('default' in imported)) return null

    const ParserCtor = (imported as {
      default: new () => {
        parseURL: (feedUrl: string) => Promise<ParsedFeedLike>
      }
    }).default
    const parser = new ParserCtor()
    const parsed = (await parser.parseURL(url)) as ParsedFeedLike
    return (parsed.items ?? [])
      .map((item) => {
        const title = String(item.title ?? '').trim()
        if (!title) return null
        const enclosure =
          item.enclosure && typeof item.enclosure === 'object' ? (item.enclosure as { url?: unknown }) : null
        return {
          title,
          link: typeof item.link === 'string' ? item.link : null,
          summary: stripHtml(String(item.contentSnippet ?? item.summary ?? '')),
          content: stripHtml(String(item['content:encoded'] ?? item.content ?? item.summary ?? '')),
          publishedAt: typeof item.isoDate === 'string' ? item.isoDate : typeof item.pubDate === 'string' ? item.pubDate : null,
          imageUrl: typeof enclosure?.url === 'string' ? enclosure.url : null,
        } satisfies FeedItem
      })
      .filter((item): item is FeedItem => Boolean(item))
  } catch {
    return null
  }
}

export async function fetchFeedItems(url: string): Promise<FeedItem[]> {
  const parsed = await parseWithDependency(url)
  if (parsed) return parsed

  const response = await fetch(url, {
    headers: {
      Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
      'User-Agent': 'ubtrippin-event-pipeline/1.0',
    },
  })

  if (!response.ok) {
    throw new Error(`Feed request failed: ${response.status} ${response.statusText}`)
  }

  const xml = await response.text()
  return parseXmlItems(xml)
}

export async function discoverFeedsFromPage(url: string): Promise<string[]> {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'ubtrippin-event-pipeline/1.0',
    },
  })

  if (!response.ok) {
    throw new Error(`Page request failed: ${response.status} ${response.statusText}`)
  }

  const html = await response.text()
  const matches = Array.from(
    html.matchAll(/<link[^>]+rel=["'][^"']*alternate[^"']*["'][^>]+type=["']application\/(rss\+xml|atom\+xml|xml)["'][^>]+href=["']([^"']+)["'][^>]*>/gi)
  )

  return Array.from(
    new Set(
      matches
        .map((match) => match[2])
        .filter(Boolean)
        .map((href) => absolutizeUrl(url, href))
    )
  )
}
