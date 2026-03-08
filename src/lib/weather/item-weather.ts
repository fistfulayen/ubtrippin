import { getWeatherIcon } from './weather-icons'

export interface TimelineWeatherDay {
  date: string
  emoji: string
  high: number
  low: number
}

export function weatherCodeToEmoji(code: number): string {
  return getWeatherIcon(code)
}

export function getWeatherForDate<T extends { date: string }>(
  days: T[] | undefined,
  date: string | null | undefined
): T | null {
  if (!days || !date) return null
  return days.find((day) => day.date === date) ?? null
}
