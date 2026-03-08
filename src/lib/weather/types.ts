import type { Json, TripItemKind } from '@/types/database'

export type TemperatureUnit = 'fahrenheit' | 'celsius'

export interface WeatherTrip {
  id: string
  user_id: string
  title: string
  start_date: string | null
  end_date: string | null
  share_enabled?: boolean
}

export interface WeatherTripItem {
  id: string
  trip_id: string | null
  kind: TripItemKind
  start_date: string
  end_date: string | null
  start_ts: string | null
  end_ts: string | null
  start_location: string | null
  end_location: string | null
  provider: string | null
  summary: string | null
  details_json: Json
}

export interface ResolvedCity {
  city: string
  query: string
  dateStart: string
  dateEnd: string
  priority: number
  sourceKinds: TripItemKind[]
}

export interface GeocodeResult {
  city: string
  latitude: number
  longitude: number
  country?: string | null
  admin1?: string | null
}

export interface ForecastDay {
  date: string
  temp_high: number
  temp_low: number
  precipitation_mm: number
  precipitation_probability: number
  weather_code: number
  weather_description: string
  wind_speed_max_mph: number
}

export interface WeatherDestination {
  city: string
  latitude: number
  longitude: number
  dates: {
    start: string
    end: string
  }
  source: 'forecast'
  daily: ForecastDay[]
}

export interface PackingList {
  essentials: string[]
  clothing: Array<string | { item: string; reason?: string | null }>
  footwear: string[]
  accessories: string[]
  tip: string
}

export interface WeatherResponsePayload {
  trip_id: string
  trip_title: string
  temp_range: {
    min: number
    max: number
    unit: '°F' | '°C'
  } | null
  destinations: WeatherDestination[]
  packing: PackingList | null
  fetched_at: string | null
  is_stale: boolean
  unit: TemperatureUnit
  can_view_packing: boolean
  should_hide_section: boolean
  empty_reason: 'no_locations' | 'out_of_window' | 'completed' | null
}
