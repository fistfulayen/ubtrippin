/**
 * Page fetcher — fetch URLs and extract readable text from HTML.
 * Rate limited to 1 request per second.
 */

const SKIP_DOMAINS = [
  'youtube.com', 'youtu.be', 'twitter.com', 'x.com',
  'facebook.com', 'instagram.com', 'tiktok.com', 'reddit.com',
]

let lastFetchTime = 0

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function shouldSkipUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return SKIP_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
  } catch {
    return true
  }
}

function stripHtml(html: string): string {
  // Remove script, style, nav, footer, header blocks
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')

  // Strip remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ')

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, ' ')
    .replace(/&\w+;/g, ' ')

  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim()

  return text
}

export interface PageContent {
  text: string
  ok: boolean
}

export async function fetchPageContent(url: string): Promise<PageContent> {
  if (shouldSkipUrl(url)) {
    return { text: '', ok: false }
  }

  // Rate limit: 1 request per second
  const now = Date.now()
  const elapsed = now - lastFetchTime
  if (elapsed < 1000) {
    await sleep(1000 - elapsed)
  }
  lastFetchTime = Date.now()

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'UBTrippin/1.0 (https://www.ubtrippin.xyz)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    })

    clearTimeout(timeout)

    if (!response.ok) {
      return { text: '', ok: false }
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return { text: '', ok: false }
    }

    const html = await response.text()
    const text = stripHtml(html)

    return { text, ok: text.length > 100 }
  } catch {
    return { text: '', ok: false }
  }
}
