/**
 * Collect demand cities from active/upcoming trips and user home cities,
 * ensure they are tracked, and trigger event discovery for stale ones.
 *
 * Usage: npx tsx scripts/collect-demand-cities.ts [--dry-run]
 */

import { createSecretClient } from '@/lib/supabase/service'
import { normaliseToCity } from '@/lib/trips/assignment'
import { runCityDiscovery } from './lib/discover-events-core'
import type { PipelineCity } from './lib/types'

const isDryRun = process.argv.includes('--dry-run')

// Keywords that indicate a non-city string (venues, transit infrastructure, etc.)
const NON_CITY_PATTERN = /\b(shop|station|mall|terminal|kiosk|shinkansen|ext\.)\b/i

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
 * Rules applied on top of normaliseToCity:
 *   'Turin Airport'                → 'Turin'   (strip Airport suffix)
 *   'KTOL'                        → null       (all-caps code)
 *   'Shizuoka Shinkansen Ext. Shop' → null     (non-city keywords)
 */
function toDemandCity(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  // Skip all-caps codes (IATA, transport codes, etc.)
  if (/^[A-Z0-9]{2,6}$/.test(trimmed)) return null

  // Strip 'Airport' suffix before further normalisation
  let city = trimmed.replace(/\s+Airport\b/i, '').trim()

  // Delegate comma/venue normalisation to the shared function
  city = normaliseToCity(city)

  // Skip if non-city keywords remain after normalisation
  if (NON_CITY_PATTERN.test(city)) return null

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

  // 9. Summary
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
