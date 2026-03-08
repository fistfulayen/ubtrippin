import { describe, expect, it } from 'vitest'
import { extractTripCities, toCityQuery } from './cities'
import type { WeatherTripItem } from './types'

function makeItem(overrides: Partial<WeatherTripItem>): WeatherTripItem {
  return {
    id: 'item-1',
    trip_id: 'trip-1',
    kind: 'flight',
    start_date: '2026-03-10',
    end_date: '2026-03-10',
    start_ts: '2026-03-10T09:00:00Z',
    end_ts: '2026-03-10T12:00:00Z',
    start_location: null,
    end_location: null,
    provider: null,
    summary: null,
    details_json: {},
    ...overrides,
  }
}

describe('toCityQuery', () => {
  it('strips airport wording while keeping city and region', () => {
    expect(toCityQuery('JFK Airport, New York, NY')).toBe('New York, NY')
  })
})

describe('extractTripCities', () => {
  it('prioritizes hotel locations over airport locations', () => {
    const cities = extractTripCities([
      makeItem({
        kind: 'flight',
        start_location: 'JFK Airport, New York, NY',
        end_location: 'MIA Airport, Miami, FL',
      }),
      makeItem({
        id: 'hotel-1',
        kind: 'hotel',
        start_date: '2026-03-10',
        end_date: '2026-03-12',
        start_ts: null,
        end_ts: null,
        start_location: 'Miami, FL',
        end_location: 'Miami, FL',
      }),
    ])

    expect(cities.map((city) => city.city)).toContain('Miami, FL')
  })

  it('filters layovers shorter than six hours', () => {
    const cities = extractTripCities([
      makeItem({
        start_location: 'Austin, TX',
        end_location: 'Denver, CO',
        start_ts: '2026-03-10T09:00:00Z',
        end_ts: '2026-03-10T11:00:00Z',
      }),
      makeItem({
        id: 'flight-2',
        start_date: '2026-03-10',
        end_date: '2026-03-10',
        start_location: 'Denver, CO',
        end_location: 'San Francisco, CA',
        start_ts: '2026-03-10T14:00:00Z',
        end_ts: '2026-03-10T16:30:00Z',
      }),
    ])

    expect(cities.map((city) => city.city)).not.toContain('Denver, CO')
  })

  it('includes overnight layovers and deduplicates by city', () => {
    const cities = extractTripCities([
      makeItem({
        id: 'flight-1',
        start_location: 'Austin, TX',
        end_location: 'Chicago, IL',
        start_ts: '2026-03-10T09:00:00Z',
        end_ts: '2026-03-10T20:00:00Z',
      }),
      makeItem({
        id: 'flight-2',
        start_date: '2026-03-11',
        end_date: '2026-03-11',
        start_location: 'Chicago, IL',
        end_location: 'New York, NY',
        start_ts: '2026-03-11T10:00:00Z',
        end_ts: '2026-03-11T12:00:00Z',
      }),
    ])

    expect(cities.map((city) => city.city)).toEqual(['Austin, TX', 'Chicago, IL', 'New York, NY'])
  })
})
