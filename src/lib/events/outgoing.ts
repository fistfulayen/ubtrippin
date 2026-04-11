/**
 * Outgoing Partner API client — fetches curated city activities and caches
 * them in city_events + outgoing_shelves with a 6-hour TTL.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSecretClient } from '@/lib/supabase/service'
import type { CityEvent, EventCategory, OutgoingShelfData, TrackedCity } from '@/types/events'

// ─── Outgoing API Types ────────────────────────────────────────────────────

interface OutgoingActivity {
  activity_id: string
  name: string
  short_description: string | null
  picture_url: string | null
  location: { lat: number; lng: number; plus_code: string | null } | null
  semantic_location: string | null
  highlights: string[]
  display_label: string
  is_bookable: boolean
  ticket_price: {
    min: number
    max: number
    currency: string
    label: string
    types: unknown[]
  } | null
  booking_domain: string | null
  estimated_fulfillment: string | null
  next_datetime: string | null
}

interface OutgoingShelf {
  slug: string
  display_name: string
  activities: OutgoingActivity[]
}

interface OutgoingHomescreenResponse {
  shelves: OutgoingShelf[]
  h3_cell: string
  city: string
}

interface H3Response {
  h3_cell: string
  resolution: number
  lat: number
  lng: number
}

// ─── Config ────────────────────────────────────────────────────────────────

const BASE_URL = 'https://api.outgoing.world/partner/v1'
const TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

function apiKey(): string {
  const key = process.env.OUTGOING_API_KEY
  if (!key) throw new Error('OUTGOING_API_KEY not set')
  return key
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey()}`,
    'Accept-Language': 'en',
  }
}

// ─── Unsplash ──────────────────────────────────────────────────────────────

async function fetchUnsplashHero(cityName: string): Promise<string | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY
  if (!key || key.startsWith('your_')) return null
  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(cityName + ' city skyline')}&orientation=landscape&per_page=1`,
    { headers: { Authorization: `Client-ID ${key}` } }
  )
  if (!res.ok) return null
  const data = await res.json()
  return data.results?.[0]?.urls?.regular ?? null
}

// ─── API Client ────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 10_000

async function fetchH3Cell(lat: number, lng: number): Promise<string> {
  const res = await fetch(`${BASE_URL}/h3?lat=${lat}&lng=${lng}`, {
    headers: headers(),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Outgoing /h3 failed: ${res.status}`)
  const data: H3Response = await res.json()
  return data.h3_cell
}

async function fetchHomescreen(h3Cell: string): Promise<OutgoingHomescreenResponse> {
  const res = await fetch(
    `${BASE_URL}/homescreen?h3_cell=${h3Cell}&limit=250&shelved=true`,
    { headers: headers(), signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
  )
  if (!res.ok) throw new Error(`Outgoing /homescreen failed: ${res.status}`)
  return res.json()
}

// ─── Mapping ───────────────────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, EventCategory> = {
  art: 'art',
  gallery: 'art',
  exhibit: 'art',
  exhibition: 'art',
  museum: 'art',
  music: 'music',
  concert: 'music',
  'live music': 'music',
  'live-music': 'music',
  'indie electronic': 'music',
  jazz: 'music',
  nightlife: 'music',
  party: 'music',
  dj: 'music',
  food: 'food',
  brunch: 'food',
  restaurant: 'food',
  dining: 'food',
  theater: 'theater',
  theatre: 'theater',
  comedy: 'theater',
  dance: 'theater',
  performance: 'theater',
  festival: 'festival',
  sports: 'sports',
  fitness: 'sports',
  'staying-active': 'sports',
  market: 'market',
  fair: 'market',
  architecture: 'architecture',
  sacred: 'sacred',
}

function mapCategory(displayLabel: string): EventCategory {
  const lower = displayLabel.toLowerCase().trim()
  if (CATEGORY_MAP[lower]) return CATEGORY_MAP[lower]
  for (const [keyword, cat] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(keyword)) return cat
  }
  return 'other'
}

function mapActivityToRow(activity: OutgoingActivity, cityId: string) {
  const today = new Date().toISOString().slice(0, 10)
  let startDate = today
  if (activity.next_datetime) {
    const parsed = new Date(activity.next_datetime)
    if (!isNaN(parsed.getTime())) {
      startDate = parsed.toISOString().slice(0, 10)
    }
  }

  const refreshPlus7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const dayAfterStart = new Date(new Date(startDate).getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  return {
    city_id: cityId,
    title: activity.name.trim(),
    description: activity.short_description?.slice(0, 2000) ?? null,
    image_url: activity.picture_url,
    venue_name: activity.semantic_location,
    venue_type: null,
    category: mapCategory(activity.display_label),
    event_tier: 'medium' as const,
    start_date: startDate,
    end_date: null,
    time_info: activity.next_datetime
      ? new Date(activity.next_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : null,
    significance_score: 50,
    source: 'outgoing',
    source_url: `outgoing:${activity.activity_id}`,
    price_info: activity.ticket_price?.label ?? null,
    booking_url: null,
    tags: activity.highlights,
    lineup: null,
    last_verified_at: new Date().toISOString(),
    expires_at: activity.next_datetime ? dayAfterStart : refreshPlus7,
  }
}

// ─── Cache Check ───────────────────────────────────────────────────────────

export function isOutgoingStale(city: TrackedCity): boolean {
  if (city.event_source !== 'outgoing') return false
  if (!city.last_refreshed_at) return true
  return Date.now() - new Date(city.last_refreshed_at).getTime() > TTL_MS
}

// ─── Refresh ───────────────────────────────────────────────────────────────

export async function refreshOutgoingForCity(city: TrackedCity): Promise<void> {
  if (city.latitude === null || city.longitude === null) return

  const supabase = createSecretClient()

  // 1. Resolve / cache H3 cell + hero image
  let h3Cell = city.h3_cell
  const cityUpdates: Record<string, unknown> = {}
  if (!h3Cell) {
    h3Cell = await fetchH3Cell(city.latitude, city.longitude)
    cityUpdates.h3_cell = h3Cell
  }
  if (!city.hero_image_url) {
    const heroUrl = await fetchUnsplashHero(city.city)
    if (heroUrl) cityUpdates.hero_image_url = heroUrl
  }
  if (Object.keys(cityUpdates).length > 0) {
    await supabase.from('tracked_cities').update(cityUpdates).eq('id', city.id)
  }

  // 2. Fetch shelved homescreen (includes catch-all shelf for complete coverage)
  const data = await fetchHomescreen(h3Cell)

  // 3. Collect unique activities across all shelves
  const seen = new Map<string, OutgoingActivity>()
  for (const shelf of data.shelves) {
    for (const activity of shelf.activities) {
      if (!seen.has(activity.activity_id)) {
        seen.set(activity.activity_id, activity)
      }
    }
  }

  if (seen.size === 0) return

  // 4. Insert new events first, then delete old ones (ensures data availability on insert failure)
  const rows = Array.from(seen.values()).map((a) => mapActivityToRow(a, city.id))
  if (rows.length > 0) {
    const { error } = await supabase.from('city_events').insert(rows)
    if (error) throw new Error(`Failed to insert Outgoing events: ${error.message}`)
  }
  // Safe to delete old events now that new ones are committed
  await supabase.from('city_events').delete()
    .eq('city_id', city.id)
    .eq('source', 'outgoing')
    .lt('last_verified_at', new Date(Date.now() - 60_000).toISOString())

  // 5. Upsert shelves (unique on city_id + shelf_slug), then remove stale ones
  const shelfRows = data.shelves.map((shelf, i) => ({
    city_id: city.id,
    shelf_slug: shelf.slug,
    display_name: shelf.display_name,
    sort_order: i,
    activity_ids: shelf.activities.map((a) => a.activity_id),
    created_at: new Date().toISOString(),
  }))
  if (shelfRows.length > 0) {
    const { error } = await supabase.from('outgoing_shelves')
      .upsert(shelfRows, { onConflict: 'city_id,shelf_slug' })
    if (error) throw new Error(`Failed to upsert Outgoing shelves: ${error.message}`)
  }
  // Remove shelves no longer returned by the API
  const currentSlugs = data.shelves.map((s) => s.slug)
  await supabase.from('outgoing_shelves')
    .delete()
    .eq('city_id', city.id)
    .not('shelf_slug', 'in', `(${currentSlugs.join(',')})`)

  // 6. Mark refresh complete — only after all writes succeed
  await supabase
    .from('tracked_cities')
    .update({ last_refreshed_at: new Date().toISOString() })
    .eq('id', city.id)
}

// ─── Query Helpers ─────────────────────────────────────────────────────────

export async function getOutgoingShelves(
  supabase: SupabaseClient,
  cityId: string
): Promise<OutgoingShelfData[]> {
  // Load shelves
  const { data: shelves, error: shelfErr } = await supabase
    .from('outgoing_shelves')
    .select('shelf_slug, display_name, sort_order, activity_ids')
    .eq('city_id', cityId)
    .order('sort_order', { ascending: true })

  if (shelfErr || !shelves || shelves.length === 0) return []

  // Load all Outgoing events for this city
  const { data: events, error: eventErr } = await supabase
    .from('city_events')
    .select(`
      id, city_id, venue_id, parent_event_id, title, venue_name, venue_type, category, event_tier,
      description, start_date, end_date, time_info, significance_score, source, source_url, image_url,
      price_info, booking_url, tags, lineup, last_verified_at, expires_at
    `)
    .eq('city_id', cityId)
    .eq('source', 'outgoing')

  if (eventErr || !events) return []

  // Build a lookup: activity_id → CityEvent
  const eventByActivityId = new Map<string, CityEvent>()
  for (const row of events) {
    const sourceUrl = row.source_url as string | null
    if (sourceUrl?.startsWith('outgoing:')) {
      const activityId = sourceUrl.slice('outgoing:'.length)
      eventByActivityId.set(activityId, row as unknown as CityEvent)
    }
  }

  // Assemble shelves with their events in order
  return shelves.map((shelf) => ({
    slug: shelf.shelf_slug as string,
    displayName: shelf.display_name as string,
    events: ((shelf.activity_ids as string[]) ?? [])
      .map((aid) => eventByActivityId.get(aid))
      .filter((e): e is CityEvent => e !== undefined),
  }))
}
