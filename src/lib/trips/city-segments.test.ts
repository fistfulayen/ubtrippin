import { describe, expect, it } from 'vitest'
import type { TripItem } from '@/types/database'
import { buildCitySegments } from './city-segments'

function makeItem(overrides: Partial<TripItem>): TripItem {
  return {
    id: crypto.randomUUID(),
    user_id: 'user-1',
    trip_id: 'trip-1',
    kind: 'other',
    provider: null,
    confirmation_code: null,
    traveler_names: [],
    start_ts: null,
    end_ts: null,
    start_date: '2026-03-08',
    end_date: null,
    start_location: null,
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
    ...overrides,
  }
}

describe('buildCitySegments', () => {
  it('returns empty array for empty input', () => {
    expect(buildCitySegments([])).toEqual([])
  })

  it('builds a single-city hotel segment', () => {
    const segments = buildCitySegments([
      makeItem({
        kind: 'hotel',
        start_date: '2026-03-08',
        end_date: '2026-03-12',
        start_location: 'Austin, TX',
      }),
    ])

    expect(segments).toHaveLength(1)
    expect(segments[0]).toMatchObject({
      city: 'Austin, TX',
      anchorType: 'hotel',
      durationNights: 4,
    })
  })

  it('builds multi-city hotel segments with one transition', () => {
    const segments = buildCitySegments([
      makeItem({
        kind: 'hotel',
        start_date: '2026-03-08',
        end_date: '2026-03-10',
        start_location: 'Paris, France',
      }),
      makeItem({
        kind: 'flight',
        start_date: '2026-03-10',
        start_ts: '2026-03-10T10:00:00+01:00',
        end_date: '2026-03-10',
        end_ts: '2026-03-10T16:00:00-05:00',
        start_location: 'Paris CDG',
        end_location: 'Austin AUS',
        details_json: { departure_airport: 'CDG', arrival_airport: 'AUS' },
      }),
      makeItem({
        kind: 'hotel',
        start_date: '2026-03-10',
        end_date: '2026-03-13',
        start_location: 'Austin, TX',
      }),
    ])

    expect(segments).toHaveLength(2)
    expect(segments[0].transitions).toHaveLength(1)
    expect(segments[1]).toMatchObject({ city: 'Austin, TX', anchorType: 'hotel' })
  })

  it('creates airport segments for flight-only trips', () => {
    const segments = buildCitySegments([
      makeItem({
        kind: 'flight',
        start_date: '2026-03-08',
        start_ts: '2026-03-08T08:00:00-05:00',
        end_ts: '2026-03-08T20:00:00+01:00',
        start_location: 'JFK',
        end_location: 'CDG',
        details_json: { departure_airport: 'JFK', arrival_airport: 'CDG' },
      }),
    ])

    expect(segments.map((segment) => segment.city)).toEqual(['New York', 'Paris'])
  })

  it('skips layovers shorter than four hours', () => {
    const segments = buildCitySegments([
      makeItem({
        kind: 'flight',
        start_date: '2026-03-08',
        start_ts: '2026-03-08T08:00:00-05:00',
        end_ts: '2026-03-08T10:00:00-05:00',
        start_location: 'JFK',
        end_location: 'ORD',
        details_json: { departure_airport: 'JFK', arrival_airport: 'ORD' },
      }),
      makeItem({
        kind: 'flight',
        start_date: '2026-03-08',
        start_ts: '2026-03-08T12:30:00-05:00',
        end_ts: '2026-03-08T16:00:00-08:00',
        start_location: 'ORD',
        end_location: 'SFO',
        details_json: { departure_airport: 'ORD', arrival_airport: 'SFO' },
      }),
    ])

    expect(segments.map((segment) => segment.city)).toEqual(['New York', 'San Francisco'])
  })

  it('includes overnight layovers as segments', () => {
    const segments = buildCitySegments([
      makeItem({
        kind: 'flight',
        start_date: '2026-03-08',
        start_ts: '2026-03-08T08:00:00-05:00',
        end_ts: '2026-03-08T10:00:00-05:00',
        start_location: 'JFK',
        end_location: 'ORD',
        details_json: { departure_airport: 'JFK', arrival_airport: 'ORD' },
      }),
      makeItem({
        kind: 'flight',
        start_date: '2026-03-09',
        start_ts: '2026-03-09T07:00:00-05:00',
        end_ts: '2026-03-09T10:00:00-08:00',
        start_location: 'ORD',
        end_location: 'SFO',
        details_json: { departure_airport: 'ORD', arrival_airport: 'SFO' },
      }),
    ])

    expect(segments.map((segment) => segment.city)).toEqual(['New York', 'Chicago', 'San Francisco'])
  })

  it('handles round trips', () => {
    const segments = buildCitySegments([
      makeItem({
        kind: 'flight',
        start_date: '2026-03-08',
        start_ts: '2026-03-08T18:00:00-05:00',
        end_ts: '2026-03-09T07:00:00+01:00',
        start_location: 'JFK',
        end_location: 'CDG',
        details_json: { departure_airport: 'JFK', arrival_airport: 'CDG' },
      }),
      makeItem({
        kind: 'hotel',
        start_date: '2026-03-09',
        end_date: '2026-03-12',
        start_location: 'Paris, France',
      }),
      makeItem({
        kind: 'flight',
        start_date: '2026-03-12',
        start_ts: '2026-03-12T13:00:00+01:00',
        end_ts: '2026-03-12T16:00:00-04:00',
        start_location: 'CDG',
        end_location: 'JFK',
        details_json: { departure_airport: 'CDG', arrival_airport: 'JFK' },
      }),
    ])

    expect(segments.map((segment) => segment.city)).toEqual(['New York', 'Paris, France', 'New York'])
  })

  it('groups metro-area airports into the same segment', () => {
    const segments = buildCitySegments([
      makeItem({
        kind: 'flight',
        start_date: '2026-03-08',
        start_ts: '2026-03-08T09:00:00-05:00',
        end_ts: '2026-03-08T15:00:00-05:00',
        start_location: 'CDG',
        end_location: 'EWR',
        details_json: { departure_airport: 'CDG', arrival_airport: 'EWR' },
      }),
      makeItem({
        kind: 'flight',
        start_date: '2026-03-08',
        start_ts: '2026-03-08T21:30:00-05:00',
        end_ts: '2026-03-09T06:00:00-08:00',
        start_location: 'JFK',
        end_location: 'SFO',
        details_json: { departure_airport: 'JFK', arrival_airport: 'SFO' },
      }),
    ])

    expect(segments.map((segment) => segment.city)).toEqual(['Paris', 'New York', 'San Francisco'])
  })

  it('attaches no-location items to the current segment', () => {
    const segments = buildCitySegments([
      makeItem({
        kind: 'hotel',
        start_date: '2026-03-08',
        end_date: '2026-03-10',
        start_location: 'Austin, TX',
      }),
      makeItem({
        kind: 'activity',
        start_date: '2026-03-09',
        summary: 'Dinner reservation',
      }),
    ])

    expect(segments[0].items).toHaveLength(2)
    expect(segments[0].items[1].summary).toBe('Dinner reservation')
  })
})
