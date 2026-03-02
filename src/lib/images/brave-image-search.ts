const BRAVE_SEARCH_API_KEY = process.env.BRAVE_SEARCH_API_KEY

interface BraveImageResult {
  title: string
  url: string
  source: string
  page_age?: string
  thumbnail: {
    src: string
  }
  properties: {
    url: string
    placeholder?: string
  }
  meta_url: {
    hostname: string
  }
}

interface BraveImageResponse {
  query: {
    original: string
    altered?: string
  }
  results: BraveImageResult[]
}

/**
 * Search for images via Brave Image Search API.
 * Returns the URL of the best result, preferring landscape images.
 * Falls back to null if no results or API key not configured.
 */
export async function searchBraveImages(
  query: string,
  options?: { count?: number }
): Promise<string | null> {
  if (!BRAVE_SEARCH_API_KEY) {
    console.warn('BRAVE_SEARCH_API_KEY not configured')
    return null
  }

  const count = options?.count ?? 5

  try {
    const params = new URLSearchParams({
      q: query,
      count: String(count),
      safesearch: 'strict',
    })

    const response = await fetch(
      `https://api.search.brave.com/res/v1/images/search?${params}`,
      {
        headers: {
          'X-Subscription-Token': BRAVE_SEARCH_API_KEY,
          Accept: 'application/json',
        },
        next: { revalidate: 86400 }, // Cache for 24 hours
      }
    )

    if (!response.ok) {
      console.error('Brave Image Search error:', response.status, response.statusText)
      return null
    }

    const data: BraveImageResponse = await response.json()

    if (!data.results || data.results.length === 0) {
      console.log('No Brave image results for:', query)
      return null
    }

    // Return the full-size image URL from the first result
    const best = data.results[0]
    const imageUrl = best.properties?.url || best.thumbnail?.src
    console.log('Brave image result:', imageUrl, 'for query:', query)
    return imageUrl || null
  } catch (error) {
    console.error('Brave Image Search failed:', error)
    return null
  }
}

/**
 * Search Brave Images and return multiple results for user selection.
 */
export async function searchBraveImageResults(
  query: string,
  count = 8
): Promise<Array<{ url: string; thumbnailUrl: string; title: string; source: string }>> {
  if (!BRAVE_SEARCH_API_KEY) {
    console.warn('BRAVE_SEARCH_API_KEY not configured')
    return []
  }

  try {
    const params = new URLSearchParams({
      q: query,
      count: String(count),
      safesearch: 'strict',
    })

    const response = await fetch(
      `https://api.search.brave.com/res/v1/images/search?${params}`,
      {
        headers: {
          'X-Subscription-Token': BRAVE_SEARCH_API_KEY,
          Accept: 'application/json',
        },
      }
    )

    if (!response.ok) return []

    const data: BraveImageResponse = await response.json()
    if (!data.results) return []

    return data.results.map((r) => ({
      url: r.properties?.url || r.thumbnail?.src,
      thumbnailUrl: r.thumbnail?.src,
      title: r.title,
      source: r.meta_url?.hostname || r.source,
    }))
  } catch {
    return []
  }
}
