import type { SupabaseClient } from '@supabase/supabase-js'
import type { TimelineEntry } from './city-segments'
import { resolveMetroAlias } from './airport-cities'

interface CityHeroRow {
  city: string
  hero_image_url: string | null
}

function cityKey(value: string): string {
  return value.split(',')[0].toLowerCase().replace(/[^a-z\s]+/g, '').trim()
}

function matchCity(segmentCity: string, trackedCity: string): boolean {
  const left = cityKey(segmentCity)
  const right = cityKey(trackedCity)
  if (left === right) return true
  if (left.includes(right) || right.includes(left)) return true
  return resolveMetroAlias(segmentCity) === resolveMetroAlias(trackedCity)
}

/**
 * Fetch hero images for tracked cities and attach them to timeline segments.
 * Single DB query, client-side matching.
 */
export async function attachCityHeroes(
  entries: TimelineEntry[],
  supabase: SupabaseClient
): Promise<TimelineEntry[]> {
  // Collect unique city names from segments
  const segmentCities = new Set<string>()
  for (const entry of entries) {
    if (entry.type === 'segment' && entry.segment) {
      segmentCities.add(entry.segment.city)
    }
  }

  if (segmentCities.size === 0) return entries

  // Single query — tracked_cities is small (<100 rows), public read
  const { data: cities } = await supabase
    .from('tracked_cities')
    .select('city, hero_image_url')
    .not('hero_image_url', 'is', null)

  if (!cities || cities.length === 0) return entries

  const heroRows = cities as CityHeroRow[]

  // Build a lookup: segment city → hero image URL
  const heroMap = new Map<string, string>()
  for (const segCity of segmentCities) {
    const match = heroRows.find((row) => row.hero_image_url && matchCity(segCity, row.city))
    if (match?.hero_image_url) {
      heroMap.set(segCity, match.hero_image_url)
    }
  }

  if (heroMap.size === 0) return entries

  return entries.map((entry) => {
    if (entry.type !== 'segment' || !entry.segment) return entry
    const heroUrl = heroMap.get(entry.segment.city)
    if (!heroUrl) return entry
    return {
      ...entry,
      segment: {
        ...entry.segment,
        heroImageUrl: heroUrl,
      },
    }
  })
}
