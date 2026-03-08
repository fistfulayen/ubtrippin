import { describe, expect, it } from 'vitest'
import { attachWeatherToSegments, getItemWeather, getWeatherEmoji } from './item-weather'
import type { CitySegment } from '@/lib/trips/city-segments'
import type { WeatherResponsePayload } from './types'

describe('item weather helpers', () => {
  it('maps WMO codes to emoji', () => {
    expect(getWeatherEmoji(95)).toBe('⛈️')
    expect(getWeatherEmoji(999)).toBe('🌤️')
  })

  it('finds item weather by date', () => {
    expect(
      getItemWeather('2026-03-09', [
        {
          date: '2026-03-09',
          temp_high: 72,
          temp_low: 55,
          precipitation_mm: 0,
          precipitation_probability: 0,
          weather_code: 1,
          weather_description: 'Mainly clear',
          wind_speed_max_mph: 10,
        },
      ])
    ).toEqual({ emoji: '🌤️', temp: '72°' })
  })

  it('attaches matching segment weather and item chips', () => {
    const segments: CitySegment[] = [
      {
        city: 'Paris, France',
        startDate: '2026-03-09',
        endDate: '2026-03-10',
        durationNights: 1,
        anchorType: 'hotel',
        items: [
          {
            id: 'item-1',
            user_id: 'user-1',
            trip_id: 'trip-1',
            kind: 'hotel',
            provider: null,
            confirmation_code: null,
            traveler_names: [],
            start_ts: null,
            end_ts: null,
            start_date: '2026-03-09',
            end_date: '2026-03-10',
            start_location: 'Paris, France',
            end_location: null,
            summary: null,
            details_json: {},
            status: 'confirmed',
            confidence: 1,
            needs_review: false,
            loyalty_flag: null,
            source_email_id: null,
            created_at: '2026-03-01T00:00:00Z',
            updated_at: '2026-03-01T00:00:00Z',
          },
        ],
        transitions: [],
      },
    ]

    const payload: WeatherResponsePayload = {
      trip_id: 'trip-1',
      trip_title: 'Trip',
      temp_range: { min: 50, max: 72, unit: '°F' },
      packing: null,
      fetched_at: null,
      is_stale: false,
      unit: 'fahrenheit',
      can_view_packing: false,
      should_hide_section: false,
      empty_reason: null,
      destinations: [
        {
          city: 'Paris',
          latitude: 0,
          longitude: 0,
          dates: { start: '2026-03-09', end: '2026-03-10' },
          source: 'forecast',
          daily: [
            {
              date: '2026-03-09',
              temp_high: 72,
              temp_low: 55,
              precipitation_mm: 0,
              precipitation_probability: 0,
              weather_code: 1,
              weather_description: 'Mainly clear',
              wind_speed_max_mph: 10,
            },
            {
              date: '2026-03-10',
              temp_high: 68,
              temp_low: 54,
              precipitation_mm: 1,
              precipitation_probability: 20,
              weather_code: 2,
              weather_description: 'Partly cloudy',
              wind_speed_max_mph: 12,
            },
          ],
        },
      ],
    }

    const [segment] = attachWeatherToSegments(segments, payload)
    expect(segment.weatherForecast).toHaveLength(2)
    expect(segment.items[0].weather).toEqual({ emoji: '🌤️', temp: '72°' })
  })
})
