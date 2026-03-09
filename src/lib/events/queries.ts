import type { SupabaseClient } from '@supabase/supabase-js'
import { normaliseToCity } from '@/lib/trips/assignment'
import type { CitySegment } from '@/lib/trips/city-segments'
import type {
  CityEvent,
  CityEventsPageData,
  DistanceGroup,
  EventCategory,
  EventSegment,
  EventTier,
  PipelineDiary,
  TrackedCity,
  VenueType,
} from '@/types/events'

interface CityRow {
  id: string
  city: string
  country: string
  country_code: string | null
  slug: string
  latitude: number | string | null
  longitude: number | string | null
  timezone: string | null
  hero_image_url: string | null
  last_refreshed_at: string | null
}

interface EventRow {
  id: string
  city_id: string
  venue_id: string | null
  parent_event_id: string | null
  title: string
  venue_name: string | null
  venue_type: string | null
  category: string | null
  event_tier: string
  description: string | null
  start_date: string
  end_date: string | null
  time_info: string | null
  significance_score: number | null
  source: string | null
  source_url: string | null
  image_url: string | null
  price_info: string | null
  booking_url: string | null
  tags: string[] | null
  lineup: Array<{ name: string; id?: string; url?: string }> | null
  last_verified_at: string | null
  expires_at: string | null
}

const categoryLabels: Record<EventCategory, string> = {
  art: 'Art & Exhibitions',
  music: 'Music & Performance',
  theater: 'Stage & Theater',
  food: 'Food & Drink',
  festival: 'Festivals',
  sports: 'Sports',
  architecture: 'Architecture',
  sacred: 'Sacred Spaces',
  market: 'Markets',
  other: 'Local Finds',
}

const tierOrder: Record<EventTier, number> = {
  major: 0,
  medium: 1,
  local: 2,
}

function toTrackedCity(row: CityRow): TrackedCity {
  return {
    ...row,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
  }
}

function toEvent(row: EventRow): CityEvent {
  return {
    id: row.id,
    city_id: row.city_id,
    venue_id: row.venue_id,
    parent_event_id: row.parent_event_id,
    title: row.title,
    venue_name: row.venue_name,
    venue_type: (row.venue_type as VenueType | null) ?? null,
    category: (row.category as EventCategory | null) ?? 'other',
    event_tier: (row.event_tier as EventTier) ?? 'medium',
    description: row.description,
    start_date: row.start_date,
    end_date: row.end_date,
    time_info: row.time_info,
    significance_score: row.significance_score ?? 50,
    source: row.source,
    source_url: row.source_url,
    image_url: row.image_url,
    price_info: row.price_info,
    booking_url: row.booking_url,
    tags: row.tags ?? [],
    lineup: row.lineup,
    last_verified_at: row.last_verified_at,
    expires_at: row.expires_at,
  }
}

function sortEvents(events: CityEvent[]): CityEvent[] {
  return [...events].sort((left, right) => {
    const tierDelta = tierOrder[left.event_tier] - tierOrder[right.event_tier]
    if (tierDelta !== 0) return tierDelta
    const scoreDelta = right.significance_score - left.significance_score
    if (scoreDelta !== 0) return scoreDelta
    return left.start_date.localeCompare(right.start_date)
  })
}

export function eventDateOverlapsRange(
  event: Pick<CityEvent, 'start_date' | 'end_date'>,
  from?: string,
  to?: string
): boolean {
  if (!from && !to) return true
  const start = event.start_date
  const end = event.end_date ?? event.start_date
  if (from && end < from) return false
  if (to && start > to) return false
  return true
}

export function nestLineupEvents(events: CityEvent[]): CityEvent[] {
  const byParent = new Map<string, CityEvent[]>()
  const roots: CityEvent[] = []

  for (const event of events) {
    if (event.parent_event_id) {
      const group = byParent.get(event.parent_event_id) ?? []
      group.push(event)
      byParent.set(event.parent_event_id, group)
    } else {
      roots.push({ ...event })
    }
  }

  return roots.map((event) => ({
    ...event,
    children: sortEvents(byParent.get(event.id) ?? []),
  }))
}

export function buildEventSegments(events: CityEvent[]): EventSegment[] {
  const grouped = new Map<string, CityEvent[]>()
  for (const event of events) {
    const key = event.category || 'other'
    const bucket = grouped.get(key) ?? []
    bucket.push(event)
    grouped.set(key, bucket)
  }

  return Array.from(grouped.entries())
    .map(([key, bucket]) => ({
      key,
      label: categoryLabels[key as EventCategory] ?? categoryLabels.other,
      events: sortEvents(bucket),
    }))
    .sort((left, right) => right.events.length - left.events.length)
}

export function buildDistanceGroups(events: CityEvent[]): DistanceGroup[] {
  return [
    {
      label: 'In the City',
      icon: 'map-pin',
      segments: buildEventSegments(events),
    },
  ]
}

export function trimEventsForFreeTier(events: CityEvent[], count: number): CityEvent[] {
  return sortEvents(events).slice(0, count)
}

export function flagEmoji(countryCode?: string | null): string {
  if (!countryCode || countryCode.length !== 2) return '📍'
  return String.fromCodePoint(...countryCode.toUpperCase().split('').map((char) => 127397 + char.charCodeAt(0)))
}

export function getMonthWindow(date = new Date()): { from: string; to: string } {
  const year = date.getFullYear()
  const month = date.getMonth()
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0)
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  }
}

export async function getTrackedCities(supabase: SupabaseClient): Promise<TrackedCity[]> {
  const { data, error } = await supabase
    .from('tracked_cities')
    .select('id, city, country, country_code, slug, latitude, longitude, timezone, hero_image_url, last_refreshed_at')
    .order('city', { ascending: true })

  if (error) throw error
  return ((data ?? []) as CityRow[]).map(toTrackedCity)
}

export async function getTrackedCityBySlug(supabase: SupabaseClient, slug: string): Promise<TrackedCity | null> {
  const { data, error } = await supabase
    .from('tracked_cities')
    .select('id, city, country, country_code, slug, latitude, longitude, timezone, hero_image_url, last_refreshed_at')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw error
  return data ? toTrackedCity(data as CityRow) : null
}

export async function getPipelineDiaryForCity(supabase: SupabaseClient, cityId: string): Promise<PipelineDiary | null> {
  const { data, error } = await supabase
    .from('event_pipeline_diary')
    .select('id, city_id, run_date, diary_text, run_metadata, next_day_plan')
    .eq('city_id', cityId)
    .order('run_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data as PipelineDiary | null) ?? null
}

export async function getCityEvents(
  supabase: SupabaseClient,
  cityId: string,
  options?: {
    from?: string
    to?: string
    tier?: EventTier
    category?: EventCategory
  }
): Promise<CityEvent[]> {
  let query = supabase
    .from('city_events')
    .select(`
      id, city_id, venue_id, parent_event_id, title, venue_name, venue_type, category, event_tier,
      description, start_date, end_date, time_info, significance_score, source, source_url, image_url,
      price_info, booking_url, tags, lineup, last_verified_at, expires_at
    `)
    .eq('city_id', cityId)
    .order('start_date', { ascending: true })
    .order('significance_score', { ascending: false })

  if (options?.tier) query = query.eq('event_tier', options.tier)
  if (options?.category) query = query.eq('category', options.category)

  const { data, error } = await query
  if (error) throw error

  const nested = nestLineupEvents(((data ?? []) as EventRow[]).map(toEvent))
  return sortEvents(nested.filter((event) => eventDateOverlapsRange(event, options?.from, options?.to)))
}

export async function getTrackedCitiesWithEventCounts(supabase: SupabaseClient): Promise<TrackedCity[]> {
  const [cities, events] = await Promise.all([
    getTrackedCities(supabase),
    supabase
      .from('city_events')
      .select('id, city_id, title, start_date, end_date, event_tier, significance_score, category, venue_name, venue_type, venue_id, parent_event_id, description, time_info, source, source_url, image_url, price_info, booking_url, tags, lineup, last_verified_at, expires_at')
      .gte('start_date', new Date().toISOString().slice(0, 10)),
  ])

  if (events.error) throw events.error
  const eventsByCity = new Map<string, CityEvent[]>()
  for (const row of ((events.data ?? []) as EventRow[]).map(toEvent)) {
    const bucket = eventsByCity.get(row.city_id) ?? []
    bucket.push(row)
    eventsByCity.set(row.city_id, bucket)
  }

  return cities
    .map((city) => {
      const cityEvents = sortEvents(eventsByCity.get(city.id) ?? [])
      return {
        ...city,
        active_event_count: cityEvents.length,
        next_notable_event: cityEvents[0]
          ? { title: cityEvents[0].title, date: cityEvents[0].start_date }
          : null,
      }
    })
    .sort((left, right) => (right.active_event_count ?? 0) - (left.active_event_count ?? 0))
}

export async function getItineraryCities(
  supabase: SupabaseClient,
  userId: string
): Promise<TrackedCity[]> {
  const { data: trips, error } = await supabase
    .from('trips')
    .select('primary_location')
    .eq('user_id', userId)
    .not('primary_location', 'is', null)

  if (error) throw error

  const cities = await getTrackedCitiesWithEventCounts(supabase)
  const tripCityNames = new Set(
    (trips ?? [])
      .map((trip) => (trip.primary_location as string | null) ?? '')
      .filter(Boolean)
      .map((location) => normaliseToCity(location))
  )

  return cities.filter((city) => tripCityNames.has(normaliseToCity(city.city)))
}

export function matchTrackedCityByName(cities: TrackedCity[], name: string): TrackedCity | null {
  const normalized = normaliseToCity(name).toLowerCase()
  return (
    cities.find((city) => normaliseToCity(city.city).toLowerCase() === normalized) ?? null
  )
}

export async function getTripTimelineEventPreviews(
  supabase: SupabaseClient,
  segments: CitySegment[]
): Promise<Record<string, { city: TrackedCity; events: CityEvent[] }>> {
  if (segments.length === 0) return {}

  const cities = await getTrackedCities(supabase)
  const uniqueCities = Array.from(
    new Set(
      segments
        .map((segment) => matchTrackedCityByName(cities, segment.city))
        .filter((city): city is TrackedCity => city !== null)
        .map((city) => city.id)
    )
  )

  if (uniqueCities.length === 0) return {}

  const { data, error } = await supabase
    .from('city_events')
    .select(`
      id, city_id, venue_id, parent_event_id, title, venue_name, venue_type, category, event_tier,
      description, start_date, end_date, time_info, significance_score, source, source_url, image_url,
      price_info, booking_url, tags, lineup, last_verified_at, expires_at
    `)
    .in('city_id', uniqueCities)

  if (error) throw error

  const allEvents = nestLineupEvents(((data ?? []) as EventRow[]).map(toEvent))
  const results: Record<string, { city: TrackedCity; events: CityEvent[] }> = {}

  for (const [index, segment] of segments.entries()) {
    const city = matchTrackedCityByName(cities, segment.city)
    if (!city) continue

    const events = sortEvents(
      allEvents.filter((event) => event.city_id === city.id && eventDateOverlapsRange(event, segment.startDate, segment.endDate))
    )

    if (events.length === 0) continue
    results[`${segment.city}-${segment.startDate}-${index}`] = {
      city,
      events: events.slice(0, 3),
    }
  }

  return results
}

export async function getCityEventsPageData(
  supabase: SupabaseClient,
  slug: string,
  options?: {
    from?: string
    to?: string
    tier?: EventTier
    category?: EventCategory
  }
): Promise<CityEventsPageData | null> {
  const city = await getTrackedCityBySlug(supabase, slug)
  if (!city) return null

  const [events, pipelineDiary] = await Promise.all([
    getCityEvents(supabase, city.id, options),
    getPipelineDiaryForCity(supabase, city.id),
  ])

  return {
    city,
    events,
    segments: buildEventSegments(events),
    distanceGroups: buildDistanceGroups(events),
    pipelineDiary,
  }
}
