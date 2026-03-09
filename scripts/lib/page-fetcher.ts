/**
 * Page fetcher — fetch URLs and extract readable text from HTML.
 * Rate limited to 1 request per second.
 * SSRF-hardened: blocks private IPs, loopback, cloud metadata, and validates redirect targets.
 */

const SKIP_DOMAINS = [
  'youtube.com', 'youtu.be', 'twitter.com', 'x.com',
  'facebook.com', 'instagram.com', 'tiktok.com', 'reddit.com',
]

/** Mutex-style rate limiter to prevent concurrent bypass of the sleep check */
let fetchQueue: Promise<void> = Promise.resolve()

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

/** Block private/internal IPs and cloud metadata endpoints to prevent SSRF */
function isBlockedHost(url: string): boolean {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()

    // Block loopback
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true
    if (hostname.endsWith('.localhost')) return true

    // Block cloud metadata
    if (hostname === '169.254.169.254') return true
    if (hostname === 'metadata.google.internal') return true

    // Block private IP ranges via regex
    if (/^10\./.test(hostname)) return true
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true
    if (/^192\.168\./.test(hostname)) return true
    if (/^0\./.test(hostname)) return true
    if (/^fc00:|^fd/.test(hostname)) return true  // IPv6 ULA
    if (/^fe80:/.test(hostname)) return true       // IPv6 link-local

    // Only allow http/https schemes
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true

    return false
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
  if (shouldSkipUrl(url) || isBlockedHost(url)) {
    return { text: '', ok: false }
  }

  // Serialized rate limiting — queue ensures 1 req/sec even under concurrent calls
  const ticket = fetchQueue.then(() => sleep(1000))
  fetchQueue = ticket

  await ticket

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)

    // Disable auto-redirect to validate each hop
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'UBTrippin/1.0 (https://www.ubtrippin.xyz)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'manual',
    })

    clearTimeout(timeout)

    // Handle redirects manually — validate the target is not internal
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) return { text: '', ok: false }

      // Resolve relative redirect URLs
      const redirectUrl = new URL(location, url).toString()
      if (isBlockedHost(redirectUrl) || shouldSkipUrl(redirectUrl)) {
        return { text: '', ok: false }
      }

      // Follow one redirect only (don't chain)
      const controller2 = new AbortController()
      const timeout2 = setTimeout(() => controller2.abort(), 10_000)
      const redirectResponse = await fetch(redirectUrl, {
        signal: controller2.signal,
        headers: {
          'User-Agent': 'UBTrippin/1.0 (https://www.ubtrippin.xyz)',
          Accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'manual',
      })
      clearTimeout(timeout2)

      if (!redirectResponse.ok) return { text: '', ok: false }

      const ct = redirectResponse.headers.get('content-type') ?? ''
      if (!ct.includes('text/html') && !ct.includes('text/plain')) return { text: '', ok: false }

      const html = await redirectResponse.text()
      return { text: stripHtml(html), ok: stripHtml(html).length > 100 }
    }

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
