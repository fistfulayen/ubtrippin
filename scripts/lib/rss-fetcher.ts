import type { FeedItem } from './types'

/**
 * Validate that a URL is safe to fetch: must be https and must resolve to a
 * public hostname (not loopback/RFC-1918/metadata ranges).
 * Throws if the URL is not acceptable.
 */
function assertSafeUrl(url: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`Invalid URL: ${url}`)
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`Unsafe URL scheme "${parsed.protocol}" — only https:// is allowed: ${url}`)
  }
  const host = parsed.hostname.toLowerCase()
  // Block loopback, link-local, and cloud metadata endpoints
  const blocked = [
    /^localhost$/,
    /^127\./,
    /^::1$/,
    /^0\.0\.0\.0$/,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,   // link-local / AWS metadata
    /^fd[0-9a-f]{2}:/i, // ULA IPv6
  ]
  for (const pattern of blocked) {
    if (pattern.test(host)) {
      throw new Error(`Blocked private/metadata host: ${host}`)
    }
  }
}

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
  // URL safety already validated by the public callers; assert here as defence-in-depth.
  assertSafeUrl(url)
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
  assertSafeUrl(url)

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
  assertSafeUrl(url)

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
