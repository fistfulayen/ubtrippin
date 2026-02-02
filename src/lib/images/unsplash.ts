import { locationToCity } from './airport-cities'

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY

interface UnsplashPhoto {
  urls: {
    regular: string
  }
  description: string | null
  alt_description: string | null
}

interface UnsplashSearchResult {
  results: UnsplashPhoto[]
}

/**
 * Fetches a destination image URL from Unsplash for a given location.
 * Converts airport codes to city names for better results.
 * Returns null if no image is found or on error.
 */
export async function getDestinationImageUrl(location: string): Promise<string | null> {
  console.log('getDestinationImageUrl called with:', location)
  console.log('UNSPLASH_ACCESS_KEY configured:', !!UNSPLASH_ACCESS_KEY)

  if (!UNSPLASH_ACCESS_KEY) {
    console.warn('UNSPLASH_ACCESS_KEY not configured')
    return null
  }

  // Convert airport codes to city names
  const cityName = locationToCity(location)
  console.log('Resolved city name:', cityName)

  // Build a travel-focused search query
  // Adding "city skyline travel" helps avoid portraits and irrelevant results
  const searchQuery = `${cityName} city skyline travel destination`
  console.log('Unsplash search query:', searchQuery)

  try {
    const params = new URLSearchParams({
      query: searchQuery,
      orientation: 'landscape',
      per_page: '5', // Get a few results to filter
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
      console.log('No Unsplash results for:', searchQuery)
      return null
    }

    // Return the first result (Unsplash relevance sorting is usually good)
    const selected = data.results[0]
    console.log('Selected image:', selected.alt_description || selected.description || 'no description')
    
    return selected.urls.regular
  } catch (error) {
    console.error('Failed to fetch Unsplash image:', error)
    return null
  }
}
