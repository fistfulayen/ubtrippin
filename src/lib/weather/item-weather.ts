import type { ForecastDay, WeatherResponsePayload } from './types'
import type { CitySegment, TripItemWithWeather } from '@/lib/trips/city-segments'

export const WMO_EMOJI: Record<number, string> = {
  0: '☀️',
  1: '🌤️',
  2: '⛅',
  3: '☁️',
  45: '🌫️',
  48: '🌫️',
  51: '🌦️',
  53: '🌦️',
  55: '🌧️',
  61: '🌧️',
  63: '🌧️',
  65: '🌧️',
  71: '🌨️',
  73: '🌨️',
  75: '❄️',
  77: '❄️',
  80: '🌦️',
  81: '🌧️',
  82: '🌧️',
  85: '🌨️',
  86: '❄️',
  95: '⛈️',
  96: '⛈️',
  99: '⛈️',
}

function normalizeCity(value: string) {
  return value.split(',')[0].trim().toLowerCase()
}

export function getWeatherEmoji(code: number): string {
  return WMO_EMOJI[code] ?? '🌤️'
}

export function getItemWeather(itemDate: string, segmentWeather: ForecastDay[]): { emoji: string; temp: string } | null {
  const match = segmentWeather.find((day) => day.date === itemDate)
  if (!match) return null

  return {
    emoji: getWeatherEmoji(match.weather_code),
    temp: `${Math.round(match.temp_high)}°`,
  }
}

export function attachWeatherToSegments(
  segments: CitySegment[],
  payload: WeatherResponsePayload | null | undefined
): CitySegment[] {
  if (!payload || payload.destinations.length === 0) {
    return segments
  }

  return segments.map((segment) => {
    const destination = payload.destinations.find(
      (candidate) =>
        normalizeCity(candidate.city) === normalizeCity(segment.city) &&
        candidate.dates.start <= segment.endDate &&
        candidate.dates.end >= segment.startDate
    )

    if (!destination) return segment

    const items = segment.items.map((item): TripItemWithWeather => ({
      ...item,
      weather: getItemWeather(item.start_date, destination.daily) ?? undefined,
    }))

    return {
      ...segment,
      items,
      weatherForecast: destination.daily.filter(
        (day) => day.date >= segment.startDate && day.date <= segment.endDate
      ),
      weatherUnit: payload.temp_range?.unit ?? (payload.unit === 'celsius' ? '°C' : '°F'),
    }
  })
}
