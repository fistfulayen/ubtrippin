/**
 * Collect demand cities from active/upcoming trips and user home cities,
 * ensure they are tracked, and trigger event discovery for stale ones.
 *
 * Usage: npx tsx scripts/collect-demand-cities.ts [--dry-run]
 */

import { createSecretClient } from '@/lib/supabase/service'
import { normaliseToCity } from '@/lib/trips/assignment'
import { resolveMetroAlias } from '@/lib/trips/airport-cities'
import { runCityDiscovery } from './lib/discover-events-core'
import type { PipelineCity } from './lib/types'

const isDryRun = process.argv.includes('--dry-run')

// Keywords that indicate a non-city string (venues, transit, hotels, addresses, etc.)
const NON_CITY_KEYWORDS = /\b(shop|station|mall|terminal|kiosk|shinkansen|ext\.|hotel|hotels|hostel|motel|inn|resort|suites?|hyatt|marriott|hilton|sheraton|sonesta|mercure|novotel|ibis|okko|mitsui|premier|surfside|garden|grand|byaku|onsen|ousenkaku|avenue|street|boulevard|road|blvd|ave|st\b|rd\b|drive|roppongi|collins|argyle|campbell|airport|airlines?|malpensa|o'hare|narita|heathrow|gatwick|orly|cdg|jfk|lhr|ewr|sfo|lax|dfw|pdx|chs|aus|mdw|mia|ltn|mxp|trn)\b/i

// Patterns that match addresses (numbers at start)
const ADDRESS_PATTERN = /^\d+[\s-]/

// Pattern for flight-like strings
const FLIGHT_PATTERN = /\b(AA|DL|UA|WN|NK|B6|AS|F9|HA|SY|AF|BA|LH|KL|AZ|IB|EK|QR|SQ|CX|NH|JL|W6)\s*\d{2,4}\b/i

// Known venue/restaurant names that slip through keyword filters
const KNOWN_VENUES = new Set([
  'la maroquinerie',
  'alhambra',
  'ginette à la folie',
  'ginette a la folie',
  'izumigaya',
  'takaragawa',
])

// Known city name aliases (normalise variants to canonical)
const CITY_ALIASES: Record<string, string> = {
  'new york city': 'New York',
  'nyc': 'New York',
  'sf': 'San Francisco',
  'la': 'Los Angeles',
  'dc': 'Washington',
}

function generateSlug(city: string): string {
  return city.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Normalise a raw location string to a city name suitable for demand tracking.
 * Returns null if the value doesn't look like a real city.
 *
 * Filters out:
 *   - IATA codes (CHS, JFK, MIA)
 *   - Airport names (Chicago O'Hare, Milan Malpensa T1)
 *   - Hotel names (Grand Hyatt Baha Mar, Mitsui Garden Hotel...)
 *   - Street addresses (9449 Collins Avenue, 6-10-3 Roppongi)
 *   - Venue names (La Maroquinerie, Alhambra)
 *   - Flight references (SFO - American Airlines 949)
 */
function toDemandCity(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  // Skip all-caps codes (IATA, transport codes, etc.)
  if (/^[A-Z0-9]{2,6}$/.test(trimmed)) return null

  // Skip anything that looks like a street address
  if (ADDRESS_PATTERN.test(trimmed)) return null

  // Skip anything containing flight numbers
  if (FLIGHT_PATTERN.test(trimmed)) return null

  // Strip 'Airport' suffix before further normalisation
  let city = trimmed.replace(/\s+Airport\b/i, '').trim()

  // Strip terminal suffixes (T1, T2, etc.)
  city = city.replace(/\s+T\d+$/i, '').trim()

  // Delegate comma/venue normalisation to the shared function
  const normalizedCity = normaliseToCity(city)
  if (!normalizedCity) return null
  city = normalizedCity

  // Skip if non-city keywords remain after normalisation
  if (NON_CITY_KEYWORDS.test(city)) return null

  // Skip very short results (likely leftover codes)
  if (city.length < 3) return null

  // Skip if it still looks like an address after normalisation
  if (ADDRESS_PATTERN.test(city)) return null

  // Apply metro area aliases (Surfside → Miami, Brooklyn → New York, etc.)
  const metro = resolveMetroAlias(city)
  if (metro !== city.toLowerCase()) {
    city = metro.replace(/\b\w/g, (c) => c.toUpperCase())
  }

  // Apply canonical name aliases
  const lower = city.toLowerCase()
  if (CITY_ALIASES[lower]) {
    city = CITY_ALIASES[lower]
  }

  // Skip known venue/restaurant names
  if (KNOWN_VENUES.has(lower)) return null

  return city || null
}

async function main() {
  const supabase = createSecretClient()
  const today = new Date().toISOString().slice(0, 10)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  console.log(`[collect-demand-cities] Starting${isDryRun ? ' (dry-run)' : ''}...`)

  // 1. Query active + upcoming trips
  const { data: trips, error: tripsError } = await supabase
    .from('trips')
    .select('id, primary_location, start_date')
    .gte('end_date', today)

  if (tripsError) throw new Error(`Failed to load trips: ${tripsError.message}`)

  // Build trip start_date lookup for sorting cities by urgency
  const tripStartDates = new Map<string, string>()
  for (const trip of trips ?? []) {
    tripStartDates.set(trip.id, trip.start_date ?? today)
  }

  // Track city → earliest trip start_date (lowercase key for consistency)
  const cityToEarliestTrip = new Map<string, string>()

  function trackCityDate(city: string, tripId: string) {
    const tripDate = tripStartDates.get(tripId) ?? today
    const key = city.toLowerCase()
    const existing = cityToEarliestTrip.get(key)
    if (!existing || tripDate < existing) {
      cityToEarliestTrip.set(key, tripDate)
    }
  }

  // 2. Extract cities from primary_location of active trips
  const demandCityNames = new Set<string>()

  for (const trip of trips ?? []) {
    const city = toDemandCity(trip.primary_location)
    if (city) {
      demandCityNames.add(city)
      trackCityDate(city, trip.id)
    }
  }

  // 3. Scan trip_items of active trips for multi-city coverage
  const activeTripIds = [...tripStartDates.keys()]
  if (activeTripIds.length > 0) {
    const { data: tripItems, error: tripItemsError } = await supabase
      .from('trip_items')
      .select('trip_id, start_location, end_location')
      .in('trip_id', activeTripIds)

    if (tripItemsError) throw new Error(`Failed to load trip_items: ${tripItemsError.message}`)

    for (const item of tripItems ?? []) {
      for (const loc of [item.start_location, item.end_location]) {
        const city = toDemandCity(loc)
        if (city) {
          demandCityNames.add(city)
          trackCityDate(city, item.trip_id)
        }
      }
    }
  }

  // 4. Query non-null home_city values from user_profiles
  const { data: profiles, error: profilesError } = await supabase
    .from('user_profiles')
    .select('home_city')
    .not('home_city', 'is', null)

  if (profilesError) throw new Error(`Failed to load user profiles: ${profilesError.message}`)

  for (const profile of profiles ?? []) {
    const city = toDemandCity(profile.home_city as string | null)
    if (city) {
      demandCityNames.add(city)
      if (!cityToEarliestTrip.has(city.toLowerCase())) {
        cityToEarliestTrip.set(city.toLowerCase(), today)
      }
    }
  }

  console.log(`[collect-demand-cities] ${demandCityNames.size} demand cities identified`)

  // 5. Load all tracked cities into a case-insensitive map
  const { data: existingCities, error: existingError } = await supabase
    .from('tracked_cities')
    .select('id, city, country, country_code, slug, timezone, last_refreshed_at')

  if (existingError) throw new Error(`Failed to load tracked cities: ${existingError.message}`)

  const trackedMap = new Map<string, PipelineCity>()
  for (const tc of existingCities ?? []) {
    trackedMap.set(tc.city.toLowerCase(), tc as PipelineCity)
  }

  // 6. Ensure each demand city is tracked; collect cities needing refresh
  const citiesToRefresh: Array<{ city: PipelineCity; earliestTrip: string }> = []
  let newCitiesCount = 0

  for (const cityName of demandCityNames) {
    let tracked = trackedMap.get(cityName.toLowerCase())

    if (!tracked) {
      const slug = generateSlug(cityName)
      newCitiesCount++
      console.log(`[collect-demand-cities] New city: ${cityName} (slug: ${slug})`)

      if (!isDryRun) {
        const { data: inserted, error: insertError } = await supabase
          .from('tracked_cities')
          .insert({
            city: cityName,
            country: '',
            slug,
            latitude: null,
            longitude: null,
            timezone: null,
            hero_image_url: null,
          })
          .select('id, city, country, country_code, slug, timezone, last_refreshed_at')
          .single()

        if (insertError) {
          // Unique constraint violation or race condition — look up the existing record
          const { data: existing } = await supabase
            .from('tracked_cities')
            .select('id, city, country, country_code, slug, timezone, last_refreshed_at')
            .ilike('city', cityName)
            .maybeSingle()

          if (existing) {
            tracked = existing as PipelineCity
          } else {
            console.warn(
              `[collect-demand-cities] Could not insert or find "${cityName}": ${insertError.message}`
            )
            continue
          }
        } else {
          tracked = inserted as PipelineCity
        }
      } else {
        // Dry-run: create a placeholder so refresh planning still works
        tracked = {
          id: 'dry-run',
          city: cityName,
          country: '',
          country_code: null,
          slug,
          timezone: null,
          last_refreshed_at: null,
        }
      }
    }

    const needsRefresh =
      !tracked.last_refreshed_at || tracked.last_refreshed_at < twentyFourHoursAgo

    if (needsRefresh) {
      const earliestTrip = cityToEarliestTrip.get(cityName.toLowerCase()) ?? today
      citiesToRefresh.push({ city: tracked, earliestTrip })
    }
  }

  // 7. Sort by soonest trip date, cap at 10
  citiesToRefresh.sort((a, b) => a.earliestTrip.localeCompare(b.earliestTrip))
  const toProcess = citiesToRefresh.slice(0, 10)

  console.log(
    `[collect-demand-cities] ${citiesToRefresh.length} cities need refresh, processing up to ${toProcess.length}`
  )

  // 8. Run discovery for each city with 30s gaps
  let refreshed = 0

  for (let i = 0; i < toProcess.length; i++) {
    const { city } = toProcess[i]
    console.log(`[collect-demand-cities] Running discovery for: ${city.city}`)

    if (!isDryRun) {
      try {
        const summary = await runCityDiscovery({ supabase, city })
        console.log(
          `[collect-demand-cities] ${city.city}: inserted ${summary.inserted}, updated ${summary.updated}, sources ${summary.sourcesChecked}`
        )
        refreshed++
      } catch (error) {
        console.error(
          `[collect-demand-cities] Error for ${city.city}:`,
          error instanceof Error ? error.message : error
        )
      }

      if (i < toProcess.length - 1) {
        await sleep(30_000)
      }
    } else {
      console.log(`[collect-demand-cities] [DRY RUN] Would run discovery for: ${city.city}`)
      refreshed++
    }
  }

  // 9. Clean up past events
  const { count: deletedCount, error: deleteError } = await supabase
    .from('city_events')
    .delete({ count: 'exact' })
    .lt('start_date', today)
    .or(`end_date.lt.${today},end_date.is.null`)

  if (deleteError) {
    console.warn(`[collect-demand-cities] Failed to clean up past events: ${deleteError.message}`)
  } else if (deletedCount && deletedCount > 0) {
    console.log(`[collect-demand-cities] Cleaned up ${deletedCount} past events`)
  }

  // 10. Summary
  console.log(
    `[collect-demand-cities] Done: ${demandCityNames.size} demand cities, ` +
      `${newCitiesCount} new tracked, ${citiesToRefresh.length} needed refresh, ${refreshed} refreshed`
  )

  process.exit(0)
}

main().catch((error) => {
  console.error(
    '[collect-demand-cities] Fatal:',
    error instanceof Error ? error.message : error
  )
  process.exit(1)
})
