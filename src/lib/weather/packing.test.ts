import { describe, expect, it } from 'vitest'
import { buildPackingPrompt, unitSymbol } from './packing'

describe('buildPackingPrompt', () => {
  it('includes trip title, destinations, and weather summary', () => {
    const prompt = buildPackingPrompt({
      tripTitle: 'Spring sprint',
      destinations: [
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
      ],
      tempRange: { min: 72, max: 84, unit: '°F' },
      travelerCount: 1,
    })

    expect(prompt).toContain('"trip_title": "Spring sprint"')
    expect(prompt).toContain('"city": "Miami, FL"')
    expect(prompt).toContain('"traveler_count": 1')
  })
})

describe('unitSymbol', () => {
  it('returns the correct display symbol', () => {
    expect(unitSymbol('fahrenheit')).toBe('°F')
    expect(unitSymbol('celsius')).toBe('°C')
  })
})
