import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'
import { extractTripCities } from './cities'
import { fetchForecast, hasTripCompleted, isTripWithinForecastWindow } from './forecast'
import { geocodeCity } from './geocode'
import { generatePackingSuggestions, unitSymbol } from './packing'
import type {
  PackingList,
  TemperatureUnit,
  WeatherDestination,
  WeatherResponsePayload,
  WeatherTrip,
  WeatherTripItem,
} from './types'

type DbClient = SupabaseClient<Database>
type WeatherCacheRow = Database['public']['Tables']['trip_weather_cache']['Row']
type WeatherCacheInsert = Database['public']['Tables']['trip_weather_cache']['Insert']

interface WeatherCacheSelectQuery {
  eq: (column: string, value: string) => {
    order: (
      column: string,
      options: { ascending: boolean }
    ) => Promise<{ data: WeatherCacheRow[] | null; error: { message: string } | null }>
  }
}

interface WeatherCacheDeleteQuery {
  eq: (column: string, value: string) => Promise<unknown>
}

interface WeatherCacheTable {
  select: (columns: string) => WeatherCacheSelectQuery
  delete: () => WeatherCacheDeleteQuery
  insert: (rows: WeatherCacheInsert[]) => Promise<unknown>
}

function weatherCacheTable(supabase: DbClient): WeatherCacheTable {
  return (supabase as unknown as { from: (_table: 'trip_weather_cache') => WeatherCacheTable }).from(
    'trip_weather_cache'
  )
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000

function nowIso() {
  return new Date().toISOString()
}

function isCacheFresh(fetchedAt: string) {
  return Date.now() - new Date(fetchedAt).getTime() < CACHE_TTL_MS
}

function parsePacking(value: Json | null): PackingList | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = value as Record<string, unknown>
  if (typeof candidate.tip !== 'string') return null
  return {
    essentials: Array.isArray(candidate.essentials) ? candidate.essentials.filter((item): item is string => typeof item === 'string') : [],
    clothing: Array.isArray(candidate.clothing)
      ? candidate.clothing.filter(
          (item): item is string | { item: string; reason?: string | null } =>
            typeof item === 'string' ||
            (!!item && typeof item === 'object' && typeof (item as { item?: unknown }).item === 'string')
        )
      : [],
    footwear: Array.isArray(candidate.footwear) ? candidate.footwear.filter((item): item is string => typeof item === 'string') : [],
    accessories: Array.isArray(candidate.accessories) ? candidate.accessories.filter((item): item is string => typeof item === 'string') : [],
    tip: candidate.tip,
  }
}

export function buildTempRange(destinations: WeatherDestination[], unit: TemperatureUnit) {
  const temps = destinations.flatMap((destination) =>
    destination.daily.flatMap((day) => [day.temp_high, day.temp_low])
  )
  if (temps.length === 0) return null
  return {
    min: Math.min(...temps),
    max: Math.max(...temps),
    unit: unitSymbol(unit),
  }
}

export async function getTemperatureUnit(userId: string, supabase: DbClient): Promise<TemperatureUnit> {
  const { data } = await supabase
    .from('user_profiles')
    .select('temperature_unit')
    .eq('id', userId)
    .maybeSingle()
  const profile = data as { temperature_unit?: string | null } | null

  return profile?.temperature_unit === 'celsius' ? 'celsius' : 'fahrenheit'
}

async function loadTripContext(tripId: string, supabase: DbClient): Promise<{
  trip: WeatherTrip
  items: WeatherTripItem[]
} | null> {
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('id, user_id, title, start_date, end_date, share_enabled')
    .eq('id', tripId)
    .maybeSingle()

  if (tripError || !trip) return null

  const { data: items, error: itemsError } = await supabase
    .from('trip_items')
    .select('id, trip_id, kind, start_date, end_date, start_ts, end_ts, start_location, end_location, provider, summary, details_json')
    .eq('trip_id', tripId)
    .order('start_date', { ascending: true })
    .order('start_ts', { ascending: true })

  if (itemsError) {
    throw new Error(itemsError.message)
  }

  return {
    trip: trip as WeatherTrip,
    items: (items ?? []) as WeatherTripItem[],
  }
}

async function loadCache(tripId: string, supabase: DbClient): Promise<WeatherCacheRow[]> {
  const { data, error } = await weatherCacheTable(supabase)
    .select('*')
    .eq('trip_id', tripId)
    .order('date_start', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as WeatherCacheRow[]
}

export async function buildWeatherPayload(params: {
  trip: WeatherTrip
  items: WeatherTripItem[]
  unit: TemperatureUnit
  includePacking: boolean
}): Promise<WeatherResponsePayload> {
  if (hasTripCompleted(params.trip.end_date)) {
    return {
      trip_id: params.trip.id,
      trip_title: params.trip.title,
      temp_range: null,
      destinations: [],
      packing: null,
      fetched_at: null,
      is_stale: false,
      unit: params.unit,
      can_view_packing: params.includePacking,
      should_hide_section: true,
      empty_reason: 'completed',
    }
  }

  if (!isTripWithinForecastWindow(params.trip.start_date)) {
    return {
      trip_id: params.trip.id,
      trip_title: params.trip.title,
      temp_range: null,
      destinations: [],
      packing: null,
      fetched_at: null,
      is_stale: false,
      unit: params.unit,
      can_view_packing: params.includePacking,
      should_hide_section: true,
      empty_reason: 'out_of_window',
    }
  }

  const cities = extractTripCities(params.items)
  if (cities.length === 0) {
    return {
      trip_id: params.trip.id,
      trip_title: params.trip.title,
      temp_range: null,
      destinations: [],
      packing: null,
      fetched_at: null,
      is_stale: false,
      unit: params.unit,
      can_view_packing: params.includePacking,
      should_hide_section: false,
      empty_reason: 'no_locations',
    }
  }

  // Fetch all cities in parallel — sequential was causing 30s+ page loads
  const results = await Promise.allSettled(
    cities.map(async (city) => {
      const geocoded = await geocodeCity(city.query)
      if (!geocoded) return null

      const daily = await fetchForecast({
        latitude: geocoded.latitude,
        longitude: geocoded.longitude,
        unit: params.unit,
        dateStart: city.dateStart,
        dateEnd: city.dateEnd,
      })

      if (daily.length === 0) return null

      return {
        city: city.city,
        latitude: geocoded.latitude,
        longitude: geocoded.longitude,
        dates: {
          start: city.dateStart,
          end: city.dateEnd,
        },
        source: 'forecast' as const,
        daily,
      }
    })
  )

  const destinations: WeatherDestination[] = results
    .filter((r): r is PromiseFulfilledResult<WeatherDestination | null> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((d): d is WeatherDestination => d !== null)

  if (destinations.length === 0) {
    return {
      trip_id: params.trip.id,
      trip_title: params.trip.title,
      temp_range: null,
      destinations: [],
      packing: null,
      fetched_at: null,
      is_stale: false,
      unit: params.unit,
      can_view_packing: params.includePacking,
      should_hide_section: true,
      empty_reason: 'out_of_window',
    }
  }

  const tempRange = buildTempRange(destinations, params.unit)
  const packing =
    params.includePacking && tempRange
      ? await generatePackingSuggestions({
          tripTitle: params.trip.title,
          destinations,
          tempRange,
          travelerCount: 1,
        })
      : null

  return {
    trip_id: params.trip.id,
    trip_title: params.trip.title,
    temp_range: tempRange,
    destinations,
    packing,
    fetched_at: nowIso(),
    is_stale: false,
    unit: params.unit,
    can_view_packing: params.includePacking,
    should_hide_section: false,
    empty_reason: null,
  }
}

export async function getTripWeather(params: {
  tripId: string
  supabase: DbClient
  userId: string
  requestedUnit?: TemperatureUnit
  forceRefresh?: boolean
  includePacking: boolean
}): Promise<WeatherResponsePayload | null> {
  const context = await loadTripContext(params.tripId, params.supabase)
  if (!context) return null

  const { trip, items } = context
  const unit = params.requestedUnit ?? (await getTemperatureUnit(params.userId, params.supabase))
  if (hasTripCompleted(trip.end_date)) {
    return {
      trip_id: trip.id,
      trip_title: trip.title,
      temp_range: null,
      destinations: [],
      packing: null,
      fetched_at: null,
      is_stale: false,
      unit,
      can_view_packing: params.includePacking,
      should_hide_section: true,
      empty_reason: 'completed',
    }
  }

  if (!isTripWithinForecastWindow(trip.start_date)) {
    return {
      trip_id: trip.id,
      trip_title: trip.title,
      temp_range: null,
      destinations: [],
      packing: null,
      fetched_at: null,
      is_stale: false,
      unit,
      can_view_packing: params.includePacking,
      should_hide_section: true,
      empty_reason: 'out_of_window',
    }
  }

  const cities = extractTripCities(items)
  if (cities.length === 0) {
    return {
      trip_id: trip.id,
      trip_title: trip.title,
      temp_range: null,
      destinations: [],
      packing: null,
      fetched_at: null,
      is_stale: false,
      unit,
      can_view_packing: params.includePacking,
      should_hide_section: false,
      empty_reason: 'no_locations',
    }
  }

  const cachedRows = await loadCache(trip.id, params.supabase)
  const cacheMatches =
    cachedRows.length === cities.length &&
    cachedRows.every(
      (row, index) =>
        row.city === cities[index]?.city &&
        row.date_start === cities[index]?.dateStart &&
        row.date_end === cities[index]?.dateEnd &&
        row.temperature_unit === unit
    )

  const freshCache = cacheMatches && cachedRows.length > 0 && cachedRows.every((row) => isCacheFresh(row.fetched_at))

  if (!params.forceRefresh && freshCache) {
    const destinations = cachedRows.map((row) => ({
      city: row.city,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      dates: {
        start: row.date_start,
        end: row.date_end,
      },
      source: 'forecast' as const,
      daily: (row.forecast_json as unknown as WeatherDestination['daily']) ?? [],
    }))

    return {
      trip_id: trip.id,
      trip_title: trip.title,
      temp_range: buildTempRange(destinations, unit),
      destinations,
      packing: params.includePacking ? parsePacking(cachedRows[0]?.packing_json ?? null) : null,
      fetched_at: cachedRows[0]?.fetched_at ?? null,
      is_stale: false,
      unit,
      can_view_packing: params.includePacking,
      should_hide_section: false,
      empty_reason: null,
    }
  }
  const refreshed = await buildWeatherPayload({
    trip,
    items,
    unit,
    includePacking: params.includePacking,
  })
  const destinations = refreshed.destinations
  const packing = refreshed.packing

  await weatherCacheTable(params.supabase).delete().eq('trip_id', trip.id)
  await weatherCacheTable(params.supabase).insert(
    destinations.map((destination, index) => ({
      trip_id: trip.id,
      user_id: trip.user_id,
      city: destination.city,
      latitude: destination.latitude,
      longitude: destination.longitude,
      date_start: destination.dates.start,
      date_end: destination.dates.end,
      temperature_unit: unit,
      forecast_json: destination.daily as unknown as Json,
      source: destination.source,
      packing_json: index === 0 ? (packing as unknown as Json) : null,
      fetched_at: nowIso(),
    }))
  )

  return {
    ...refreshed,
    fetched_at: nowIso(),
  }
}

export function canRefreshWeather(lastFetchedAt: string | null, now = Date.now()) {
  if (!lastFetchedAt) return true
  return now - new Date(lastFetchedAt).getTime() >= 60_000
}
