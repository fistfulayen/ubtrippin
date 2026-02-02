const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY

interface UnsplashSearchResult {
  results: {
    urls: {
      regular: string
    }
  }[]
}

/**
 * Fetches a destination image URL from Unsplash for a given location.
 * Returns null if no image is found or on error.
 */
export async function getDestinationImageUrl(location: string): Promise<string | null> {
  console.log('getDestinationImageUrl called with:', location)
  console.log('UNSPLASH_ACCESS_KEY configured:', !!UNSPLASH_ACCESS_KEY)

  if (!UNSPLASH_ACCESS_KEY) {
    console.warn('UNSPLASH_ACCESS_KEY not configured')
    return null
  }

  try {
    const params = new URLSearchParams({
      query: location,
      orientation: 'landscape',
      per_page: '1',
    })

    const response = await fetch(
      `https://api.unsplash.com/search/photos?${params}`,
      {
        headers: {
          Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
        },
        next: { revalidate: 86400 }, // Cache for 24 hours
      }
    )

    if (!response.ok) {
      console.error('Unsplash API error:', response.status, response.statusText)
      return null
    }

    const data: UnsplashSearchResult = await response.json()

    if (data.results.length === 0) {
      return null
    }

    return data.results[0].urls.regular
  } catch (error) {
    console.error('Failed to fetch Unsplash image:', error)
    return null
  }
}
