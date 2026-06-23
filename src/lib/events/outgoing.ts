import type { SupabaseClient } from '@supabase/supabase-js'
import { createSecretClient } from '@/lib/supabase/service'
import type { CityEvent, EventCategory, OutgoingShelfData, TrackedCity } from '@/types/events'

interface OutgoingActivity {
  activity_id: string
  name: string
  short_description?: string | null
  picture_url?: string | null
  location?: { lat: number; lng: number; plus_code?: string | null } | null
  semantic_location?: string | null
  highlights?: string[] | null
  display_label?: string | null
  is_bookable?: boolean | null
  ticket_price?: { min?: number | null; max?: number | null; currency?: string | null; label?: string | null; types?: unknown[] } | null
  booking_domain?: string | null
  booking_url?: string | null
  url?: string | null
  web_url?: string | null
  detail_url?: string | null
  estimated_fulfillment?: string | null
  next_datetime?: string | null
}

interface OutgoingShelf {
  slug: string
  display_name: string
  activities: OutgoingActivity[]
}

interface OutgoingHomescreenResponse {
  shelves: OutgoingShelf[]
  h3_cell?: string
  city?: string
}

interface H3Response {
  h3_cell: string
}

interface ShelfRow {
  shelf_slug: string
  display_name: string
  sort_order: number
  activity_ids: string[] | null
}

const BASE_URL = 'https://api.outgoing.world/partner/v1'
const TTL_MS = 6 * 60 * 60 * 1000
const REFRESH_LOCK_MS = 10 * 60 * 1000
const FETCH_TIMEOUT_MS = 10_000

const CATEGORY_MAP: Record<string, EventCategory> = {
  art: 'art',
  gallery: 'art',
  exhibit: 'art',
  exhibition: 'art',
  museum: 'art',
  music: 'music',
  concert: 'music',
  nightlife: 'music',
  jazz: 'music',
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
  market: 'market',
  fair: 'market',
  architecture: 'architecture',
  sacred: 'sacred',
}

function outgoingApiKey(): string {
  const key = process.env.OUTGOING_API_KEY
  if (!key || key.startsWith('your_')) throw new Error('OUTGOING_API_KEY is not configured')
  return key
}

function outgoingHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${outgoingApiKey()}`,
    'Accept-Language': 'en',
  }
}

function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null
  } catch {
    return null
  }
}

function mapCategory(displayLabel: string | null | undefined): EventCategory {
  const lower = (displayLabel ?? '').toLowerCase().trim()
  if (!lower) return 'other'
  if (CATEGORY_MAP[lower]) return CATEGORY_MAP[lower]
  for (const [keyword, category] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(keyword)) return category
  }
  return 'other'
}

function sourceUrlForActivity(activity: OutgoingActivity): string | null {
  return safeHttpUrl(activity.detail_url) ?? safeHttpUrl(activity.web_url) ?? safeHttpUrl(activity.url)
}

function bookingUrlForActivity(activity: OutgoingActivity): string | null {
  return safeHttpUrl(activity.booking_url)
}

function startDateForActivity(activity: OutgoingActivity, now = new Date()): string {
  if (activity.next_datetime) {
    const parsed = new Date(activity.next_datetime)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  }
  return now.toISOString().slice(0, 10)
}

function timeInfoForActivity(activity: OutgoingActivity): string | null {
  if (!activity.next_datetime) return null
  const parsed = new Date(activity.next_datetime)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function mapOutgoingActivityToEventRow(activity: OutgoingActivity, cityId: string, now = new Date()) {
  const startDate = startDateForActivity(activity, now)
  const expiresAt = new Date(new Date(`${startDate}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  return {
    city_id: cityId,
    title: activity.name.trim(),
    description: activity.short_description?.slice(0, 2000) ?? null,
    image_url: safeHttpUrl(activity.picture_url),
    venue_name: activity.semantic_location ?? null,
    venue_type: null,
    category: mapCategory(activity.display_label),
    event_tier: 'medium' as const,
    start_date: startDate,
    end_date: null,
    time_info: timeInfoForActivity(activity),
    significance_score: 50,
    source: 'outgoing',
    source_url: sourceUrlForActivity(activity),
    external_id: activity.activity_id,
    price_info: activity.ticket_price?.label ?? null,
    booking_url: bookingUrlForActivity(activity),
    tags: activity.highlights ?? [],
    lineup: null,
    last_verified_at: now.toISOString(),
    expires_at: expiresAt,
  }
}

export function isOutgoingStale(city: Pick<TrackedCity, 'event_source' | 'last_refreshed_at'>, now = new Date()): boolean {
  if (city.event_source !== 'outgoing') return false
  if (!city.last_refreshed_at) return true
  return now.getTime() - new Date(city.last_refreshed_at).getTime() > TTL_MS
}

function refreshInProgress(city: Pick<TrackedCity, 'outgoing_refresh_started_at'>, now = new Date()): boolean {
  if (!city.outgoing_refresh_started_at) return false
  return now.getTime() - new Date(city.outgoing_refresh_started_at).getTime() < REFRESH_LOCK_MS
}

async function fetchH3Cell(lat: number, lng: number): Promise<string> {
  const res = await fetch(`${BASE_URL}/h3?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`, {
    headers: outgoingHeaders(),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Outgoing /h3 failed: ${res.status}`)
  const data = await res.json() as H3Response
  return data.h3_cell
}

async function fetchHomescreen(h3Cell: string): Promise<OutgoingHomescreenResponse> {
  const res = await fetch(`${BASE_URL}/homescreen?h3_cell=${encodeURIComponent(h3Cell)}&limit=250&shelved=true`, {
    headers: outgoingHeaders(),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Outgoing /homescreen failed: ${res.status}`)
  return res.json() as Promise<OutgoingHomescreenResponse>
}

export async function refreshOutgoingForCity(city: TrackedCity, now = new Date()): Promise<{ refreshed: boolean; skipped: boolean }> {
  if (city.event_source !== 'outgoing') return { refreshed: false, skipped: true }
  if (city.latitude === null || city.longitude === null) return { refreshed: false, skipped: true }
  if (!isOutgoingStale(city, now) || refreshInProgress(city, now)) return { refreshed: false, skipped: true }

  const supabase = createSecretClient() as unknown as SupabaseClient
  const startedAt = now.toISOString()
  await supabase
    .from('tracked_cities')
    .update({ outgoing_refresh_started_at: startedAt } as never)
    .eq('id', city.id)

  try {
    let h3Cell = city.h3_cell
    if (!h3Cell) {
      h3Cell = await fetchH3Cell(city.latitude, city.longitude)
      await supabase.from('tracked_cities').update({ h3_cell: h3Cell } as never).eq('id', city.id)
    }

    const data = await fetchHomescreen(h3Cell)
    const activities = new Map<string, OutgoingActivity>()
    for (const shelf of data.shelves ?? []) {
      for (const activity of shelf.activities ?? []) {
        if (activity.activity_id && activity.name?.trim()) activities.set(activity.activity_id, activity)
      }
    }

    const verifiedAt = new Date().toISOString()
    const eventRows = Array.from(activities.values()).map((activity) => ({
      ...mapOutgoingActivityToEventRow(activity, city.id, new Date(verifiedAt)),
      last_verified_at: verifiedAt,
    }))

    if (eventRows.length > 0) {
      const { error } = await supabase
        .from('city_events')
        .upsert(eventRows as never, { onConflict: 'city_id,source,external_id' })
      if (error) throw new Error(`Failed to upsert Outgoing events: ${error.message}`)
    }

    await supabase
      .from('city_events')
      .delete()
      .eq('city_id', city.id)
      .eq('source', 'outgoing')
      .lt('last_verified_at', verifiedAt)

    const shelfRows = (data.shelves ?? []).map((shelf, index) => ({
      city_id: city.id,
      shelf_slug: shelf.slug,
      display_name: shelf.display_name,
      sort_order: index,
      activity_ids: (shelf.activities ?? []).map((activity) => activity.activity_id).filter(Boolean),
      last_verified_at: verifiedAt,
      updated_at: verifiedAt,
    }))

    if (shelfRows.length > 0) {
      const { error } = await supabase
        .from('outgoing_shelves')
        .upsert(shelfRows as never, { onConflict: 'city_id,shelf_slug' })
      if (error) throw new Error(`Failed to upsert Outgoing shelves: ${error.message}`)
    }

    await supabase
      .from('outgoing_shelves')
      .delete()
      .eq('city_id', city.id)
      .lt('last_verified_at', verifiedAt)

    await supabase
      .from('tracked_cities')
      .update({ last_refreshed_at: verifiedAt, outgoing_refresh_started_at: null } as never)
      .eq('id', city.id)

    return { refreshed: true, skipped: false }
  } catch (error) {
    await supabase
      .from('tracked_cities')
      .update({ outgoing_refresh_started_at: null } as never)
      .eq('id', city.id)
    throw error
  }
}

export async function getOutgoingShelves(
  supabase: SupabaseClient,
  cityId: string,
  events: CityEvent[]
): Promise<OutgoingShelfData[]> {
  if (events.length === 0) return []

  const { data, error } = await supabase
    .from('outgoing_shelves')
    .select('shelf_slug, display_name, sort_order, activity_ids')
    .eq('city_id', cityId)
    .order('sort_order', { ascending: true })

  if (error) throw error

  const eventByExternalId = new Map<string, CityEvent>()
  for (const event of events) {
    if (event.source === 'outgoing' && event.external_id) eventByExternalId.set(event.external_id, event)
  }

  return ((data ?? []) as ShelfRow[])
    .map((shelf) => ({
      slug: shelf.shelf_slug,
      displayName: shelf.display_name,
      events: (shelf.activity_ids ?? [])
        .map((activityId) => eventByExternalId.get(activityId))
        .filter((event): event is CityEvent => event !== undefined),
    }))
    .filter((shelf) => shelf.events.length > 0)
}

export function hasOutgoingEvents(events: CityEvent[]): boolean {
  return events.some((event) => event.source === 'outgoing')
}
