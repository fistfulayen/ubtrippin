import { describe, expect, it } from 'vitest'
import { buildTempRange, canRefreshWeather } from './service'

describe('buildTempRange', () => {
  it('computes min and max temperatures across destinations', () => {
    const range = buildTempRange(
      [
        {
          city: 'Miami, FL',
          latitude: 0,
          longitude: 0,
          dates: { start: '2026-03-10', end: '2026-03-12' },
          source: 'forecast',
          daily: [
            {
              date: '2026-03-10',
              temp_high: 84,
              temp_low: 72,
              precipitation_mm: 0,
              precipitation_probability: 20,
              weather_code: 1,
              weather_description: 'Mainly clear',
              wind_speed_max_mph: 10,
            },
          ],
        },
        {
          city: 'New York, NY',
          latitude: 0,
          longitude: 0,
          dates: { start: '2026-03-13', end: '2026-03-15' },
          source: 'forecast',
          daily: [
            {
              date: '2026-03-13',
              temp_high: 44,
              temp_low: 31,
              precipitation_mm: 4,
              precipitation_probability: 60,
              weather_code: 61,
              weather_description: 'Rain',
              wind_speed_max_mph: 15,
            },
          ],
        },
      ],
      'fahrenheit'
    )

    expect(range).toEqual({ min: 31, max: 84, unit: '°F' })
  })
})

describe('canRefreshWeather', () => {
  it('rate limits refreshes to once per minute', () => {
    const now = Date.UTC(2026, 2, 8, 12, 0, 0)
    expect(canRefreshWeather(new Date(now - 30_000).toISOString(), now)).toBe(false)
    expect(canRefreshWeather(new Date(now - 70_000).toISOString(), now)).toBe(true)
  })
})
