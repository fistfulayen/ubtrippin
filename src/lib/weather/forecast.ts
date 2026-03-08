import { addDays, differenceInCalendarDays, formatISO } from 'date-fns'
import { getWeatherDescription } from './weather-icons'
import type { ForecastDay, TemperatureUnit } from './types'

interface OpenMeteoForecastResponse {
  daily?: {
    time: string[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_sum: number[]
    precipitation_probability_max: number[]
    weathercode: number[]
    wind_speed_10m_max: number[]
  }
}

function todayUtc() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

export function isTripWithinForecastWindow(startDate: string | null) {
  if (!startDate) return false
  const parsed = new Date(`${startDate}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return false
  return differenceInCalendarDays(parsed, todayUtc()) <= 16
}

export function hasTripCompleted(endDate: string | null) {
  if (!endDate) return false
  const parsed = new Date(`${endDate}T23:59:59Z`)
  return !Number.isNaN(parsed.getTime()) && parsed < new Date()
}

export async function fetchForecast(params: {
  latitude: number
  longitude: number
  unit: TemperatureUnit
  dateStart: string
  dateEnd: string
}): Promise<ForecastDay[]> {
  if (!isTripWithinForecastWindow(params.dateStart)) return []

  const cappedEnd = formatISO(addDays(todayUtc(), 15), {
    representation: 'date',
  })
  const effectiveEnd = params.dateEnd > cappedEnd ? cappedEnd : params.dateEnd

  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(params.latitude))
  url.searchParams.set('longitude', String(params.longitude))
  url.searchParams.set(
    'daily',
    'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weathercode,wind_speed_10m_max'
  )
  url.searchParams.set('temperature_unit', params.unit)
  url.searchParams.set('wind_speed_unit', 'mph')
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('start_date', params.dateStart)
  url.searchParams.set('end_date', effectiveEnd)

  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Forecast failed with status ${response.status}`)
  }

  const payload = (await response.json()) as OpenMeteoForecastResponse
  const daily = payload.daily
  if (!daily) return []

  return daily.time.map((date, index) => ({
    date,
    temp_high: daily.temperature_2m_max[index] ?? 0,
    temp_low: daily.temperature_2m_min[index] ?? 0,
    precipitation_mm: daily.precipitation_sum[index] ?? 0,
    precipitation_probability: daily.precipitation_probability_max[index] ?? 0,
    weather_code: daily.weathercode[index] ?? 0,
    weather_description: getWeatherDescription(daily.weathercode[index] ?? 0),
    wind_speed_max_mph: daily.wind_speed_10m_max[index] ?? 0,
  }))
}
