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
 * Destination-aware search queries.
 * Instead of generic "city skyline travel", use queries that capture
 * what makes each destination visually distinctive.
 */
const DESTINATION_QUERIES: Record<string, string> = {
  // Asia
  'Tokyo': 'Tokyo neon streets Shibuya night',
  'Kyoto': 'Kyoto temple bamboo garden',
  'Osaka': 'Osaka Dotonbori street food neon',
  'Seoul': 'Seoul Bukchon hanok village',
  'Bangkok': 'Bangkok temple golden wat',
  'Singapore': 'Singapore Marina Bay skyline night',
  'Hong Kong': 'Hong Kong Victoria Peak skyline',
  'Taipei': 'Taipei night market street',
  'Bali': 'Bali rice terrace temple tropical',
  'Hanoi': 'Hanoi old quarter street life',
  'Ho Chi Minh City': 'Saigon street motorbikes cityscape',

  // Europe
  'Paris': 'Paris rooftops golden hour Eiffel',
  'London': 'London Thames Parliament evening',
  'Rome': 'Rome Colosseum golden light',
  'Barcelona': 'Barcelona Gaudi architecture colorful',
  'Amsterdam': 'Amsterdam canals houses bikes',
  'Berlin': 'Berlin street art urban culture',
  'Prague': 'Prague old town bridges river',
  'Lisbon': 'Lisbon tram colorful streets hills',
  'Istanbul': 'Istanbul mosque Bosphorus sunset',
  'Vienna': 'Vienna palace architecture classical',
  'Florence': 'Florence Duomo Ponte Vecchio sunset',
  'Venice': 'Venice canals gondola architecture',
  'Milan': 'Milan Duomo Galleria architecture',
  'Turin': 'Turin Mole Antonelliana Alps cityscape',
  'Munich': 'Munich Marienplatz Bavarian architecture',
  'Copenhagen': 'Copenhagen Nyhavn colorful harbor',
  'Stockholm': 'Stockholm old town Gamla Stan water',
  'Oslo': 'Oslo fjord opera house modern',
  'Helsinki': 'Helsinki harbor architecture Nordic',
  'Tallinn': 'Tallinn old town medieval walls towers',
  'Dubrovnik': 'Dubrovnik walls Adriatic old town',
  'Athens': 'Athens Acropolis Parthenon sunset',
  'Edinburgh': 'Edinburgh castle old town moody',
  'Dublin': 'Dublin Temple Bar colorful evening',
  'Reykjavik': 'Iceland Reykjavik colorful houses Hallgrimskirkja',
  'Zurich': 'Zurich lake Alps old town',
  'Geneva': 'Geneva lake jet deau Alps',
  'Budapest': 'Budapest Parliament Danube night lights',
  'Krakow': 'Krakow old town market square',
  'Warsaw': 'Warsaw old town colorful rebuilt',

  // Americas
  'New York City': 'New York Manhattan skyline Central Park',
  'Los Angeles': 'Los Angeles sunset palm trees skyline',
  'San Francisco': 'San Francisco Golden Gate fog bay',
  'Miami': 'Miami Beach art deco ocean drive',
  'New Orleans': 'New Orleans French Quarter jazz balconies',
  'Austin Texas': 'Austin Texas Congress Bridge skyline',
  'Chicago': 'Chicago skyline river architecture',
  'Seattle': 'Seattle Pike Place Market skyline Rainier',
  'Las Vegas': 'Las Vegas Strip night lights desert',
  'Boston': 'Boston harbor brownstone autumn',
  'Portland Oregon': 'Portland Oregon bridges forests urban',
  'Denver': 'Denver skyline Rocky Mountains sunset',
  'Honolulu Hawaii': 'Hawaii Waikiki beach Diamond Head tropical',
  'Mexico City': 'Mexico City Palacio Bellas Artes colorful',
  'Cancun': 'Cancun turquoise Caribbean beach resort',
  'Buenos Aires': 'Buenos Aires La Boca colorful tango',
  'Rio de Janeiro': 'Rio de Janeiro Sugarloaf Copacabana panoramic',
  'Lima': 'Lima Miraflores coast Pacific sunset',
  'Havana': 'Havana vintage cars colorful streets Malecon',

  // Middle East & Africa
  'Dubai': 'Dubai skyline Burj Khalifa futuristic',
  'Marrakech': 'Marrakech medina colorful spices souks',
  'Cape Town': 'Cape Town Table Mountain ocean coastline',
  'Nairobi': 'Nairobi skyline safari Kenya',
  'Cairo': 'Cairo pyramids Giza cityscape',
  'Tel Aviv': 'Tel Aviv beach Mediterranean modern',
  'Jerusalem': 'Jerusalem old city golden walls',

  // Oceania
  'Sydney': 'Sydney Opera House Harbour Bridge',
  'Melbourne': 'Melbourne laneways street art urban',
  'Auckland': 'Auckland Sky Tower harbour waterfront',
  'Queenstown': 'Queenstown mountains lake adventure',
}

/**
 * Builds a destination-aware search query.
 * Uses curated queries for known destinations, falls back to
 * a smarter generic query for unknown cities.
 */
function buildSearchQuery(cityName: string): string {
  // Check for exact match
  if (DESTINATION_QUERIES[cityName]) {
    return DESTINATION_QUERIES[cityName]
  }

  // Check for partial match (e.g., "New York" matches "New York City")
  for (const [key, query] of Object.entries(DESTINATION_QUERIES)) {
    if (key.toLowerCase().includes(cityName.toLowerCase()) ||
        cityName.toLowerCase().includes(key.toLowerCase())) {
      return query
    }
  }

  // Smart fallback: city name + "travel landmark scenic" 
  // Avoids the generic "skyline" look that makes every city look the same
  return `${cityName} travel landmark scenic landscape`
}

/**
 * Fetches a destination image URL from Unsplash for a given location.
 * Converts airport codes to city names for better results.
 * Uses destination-aware queries for distinctive, aspirational images.
 * Returns null if no image is found or on error.
 */
export async function getDestinationImageUrl(location: string): Promise<string | null> {
  if (!UNSPLASH_ACCESS_KEY) {
    console.warn('UNSPLASH_ACCESS_KEY not configured')
    return null
  }

  // Convert airport codes to city names
  const cityName = locationToCity(location)

  // Build destination-aware query
  const searchQuery = buildSearchQuery(cityName)
  console.log(`Unsplash search: "${location}" → "${cityName}" → "${searchQuery}"`)

  try {
    const params = new URLSearchParams({
      query: searchQuery,
      orientation: 'landscape',
      per_page: '5',
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
