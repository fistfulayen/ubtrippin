/**
 * Sync tracked_cities with actual user trips.
 * Adds cities users are traveling to. Removes cities nobody has trips for.
 *
 * Usage: npx tsx scripts/sync-tracked-cities.ts [--dry-run]
 */

import { createSecretClient } from '@/lib/supabase/service'
import { normaliseToCity } from '@/lib/trips/assignment'

function slugify(city: string): string {
  return city.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

// Cities that are clearly not real destinations (parking lots, venues, airports, stations)
const IGNORE_PATTERNS = [
  /^[A-Z]{3,4}$/,           // Airport codes: JFK, KTOL
  /parking/i,
  /terminal/i,
  /gate\s/i,
  /^P\d/,                   // P7 General Parking
  /porta\s/i,               // Train stations: Torino Porta Susa
  /gare\s/i,                // French train stations
  /station/i,
  /maroquinerie/i,          // Venues
  /alhambra/i,              // Venues (Alhambra, Paris)
  /musicale/i,              // La Seine Musicale
]

function shouldIgnore(city: string): boolean {
  return IGNORE_PATTERNS.some(pattern => pattern.test(city))
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const supabase = createSecretClient()

  // 1. Get all unique cities from user trips
  const { data: trips, error: tripsError } = await supabase
    .from('trips')
    .select('primary_location')
    .not('primary_location', 'is', null)

  if (tripsError) throw new Error(`Failed to fetch trips: ${tripsError.message}`)

  const tripCities = new Map<string, string>() // normalised → best original
  for (const trip of trips ?? []) {
    const loc = trip.primary_location as string
    const normalised = normaliseToCity(loc)
    if (!normalised || shouldIgnore(normalised)) continue
    // Keep the cleanest version of the city name
    if (!tripCities.has(normalised.toLowerCase()) || normalised.length < (tripCities.get(normalised.toLowerCase())?.length ?? 999)) {
      tripCities.set(normalised.toLowerCase(), normalised)
    }
  }

  console.log(`Found ${tripCities.size} unique cities from user trips`)

  // 2. Get current tracked cities
  const { data: tracked, error: trackedError } = await supabase
    .from('tracked_cities')
    .select('id, city, slug')

  if (trackedError) throw new Error(`Failed to fetch tracked cities: ${trackedError.message}`)

  const trackedMap = new Map<string, { id: string; slug: string }>()
  for (const tc of tracked ?? []) {
    trackedMap.set(tc.city.toLowerCase(), { id: tc.id, slug: tc.slug })
  }

  // 3. Add missing cities
  const toAdd: string[] = []
  for (const [key, city] of tripCities) {
    if (!trackedMap.has(key)) {
      toAdd.push(city)
    }
  }

  if (toAdd.length > 0) {
    console.log(`\nAdding ${toAdd.length} new cities:`)
    for (const city of toAdd) {
      const slug = slugify(city)
      console.log(`  + ${city} (${slug})`)
      if (!dryRun) {
        const { error } = await supabase
          .from('tracked_cities')
          .insert({ city, slug, country: '', country_code: null })
        if (error) {
          console.error(`    FAILED: ${error.message}`)
        }
      }
    }
  } else {
    console.log('\nNo new cities to add.')
  }

  // 4. Find tracked cities nobody has trips for
  const unused: Array<{ id: string; city: string }> = []
  for (const tc of tracked ?? []) {
    if (!tripCities.has(tc.city.toLowerCase())) {
      unused.push({ id: tc.id, city: tc.city })
    }
  }

  if (unused.length > 0) {
    console.log(`\nTracked cities with no user trips (${unused.length}):`)
    for (const u of unused) {
      console.log(`  - ${u.city}`)
    }
    // Don't auto-delete — just report. Cities may have curated events.
    console.log('  (Not removing automatically — these may have curated content)')
  }

  console.log('\nDone.')
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
