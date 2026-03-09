import { describe, expect, it } from 'vitest'
import type { TripItem } from '@/types/database'
import { buildTimeline } from './city-segments'

function makeItem(overrides: Partial<TripItem>): TripItem {
  return {
    id: crypto.randomUUID(),
    user_id: 'user-1',
    trip_id: 'trip-1',
    kind: 'flight',
    provider: null,
    confirmation_code: null,
    traveler_names: [],
    start_ts: null,
    end_ts: null,
    start_date: '2026-03-09',
    end_date: '2026-03-09',
    start_location: null,
    end_location: null,
    summary: null,
    details_json: {},
    status: 'confirmed',
    confidence: 1,
    needs_review: false,
    loyalty_flag: null,
    source_email_id: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

describe('buildTimeline', () => {
  it('groups connections first, then segments cities from the grouped journeys', () => {
    const items: TripItem[] = [
      makeItem({
        provider: 'Air France',
        start_date: '2026-03-09',
        end_date: '2026-03-09',
        start_ts: '2026-03-09T10:00:00+01:00',
        end_ts: '2026-03-09T14:30:00-04:00',
        start_location: 'CDG',
        end_location: 'MIA',
        details_json: {
          departure_airport: 'CDG',
          arrival_airport: 'MIA',
          departure_local_time: '10:00',
          arrival_local_time: '14:30',
        },
      }),
      makeItem({
        kind: 'hotel',
        start_date: '2026-03-09',
        end_date: '2026-03-10',
        start_location: 'Grand Beach Hotel Surfside, 9449 Collins Avenue, Surfside, Florida 33154',
        summary: 'Grand Beach Hotel Surfside',
      }),
      makeItem({
        provider: 'United',
        start_date: '2026-03-10',
        end_date: '2026-03-10',
        start_ts: '2026-03-10T11:00:00-04:00',
        end_ts: '2026-03-10T14:05:00-04:00',
        start_location: 'MIA',
        end_location: 'EWR',
        details_json: {
          departure_airport: 'MIA',
          arrival_airport: 'EWR',
          departure_local_time: '11:00',
          arrival_local_time: '14:05',
        },
      }),
      makeItem({
        provider: 'United',
        start_date: '2026-03-13',
        end_date: '2026-03-13',
        start_ts: '2026-03-13T09:00:00-04:00',
        end_ts: '2026-03-13T12:15:00-05:00',
        start_location: 'EWR',
        end_location: 'AUS',
        details_json: {
          departure_airport: 'EWR',
          arrival_airport: 'AUS',
          departure_local_time: '09:00',
          arrival_local_time: '12:15',
        },
      }),
      makeItem({
        kind: 'hotel',
        start_date: '2026-03-13',
        end_date: '2026-03-14',
        start_location: 'The Stephen F Austin Royal Sonesta Hotel',
        summary: 'Hotel booking at The Stephen F Austin Royal Sonesta Hotel in Austin, TX',
      }),
      makeItem({
        provider: 'American',
        start_date: '2026-03-14',
        end_date: '2026-03-14',
        start_ts: '2026-03-14T08:00:00-05:00',
        end_ts: '2026-03-14T09:05:00-05:00',
        start_location: 'AUS',
        end_location: 'DFW',
        details_json: {
          departure_airport: 'AUS',
          arrival_airport: 'DFW',
          departure_local_time: '08:00',
          arrival_local_time: '09:05',
        },
      }),
      makeItem({
        provider: 'American',
        start_date: '2026-03-14',
        end_date: '2026-03-14',
        start_ts: '2026-03-14T10:45:00-05:00',
        end_ts: '2026-03-14T12:35:00-07:00',
        start_location: 'DFW',
        end_location: 'PDX',
        details_json: {
          departure_airport: 'DFW',
          arrival_airport: 'PDX',
          departure_local_time: '10:45',
          arrival_local_time: '12:35',
        },
      }),
      makeItem({
        provider: 'Southwest',
        start_date: '2026-03-20',
        end_date: '2026-03-20',
        start_ts: '2026-03-20T07:15:00-07:00',
        end_ts: '2026-03-20T13:05:00-05:00',
        start_location: 'PDX',
        end_location: 'MDW',
        details_json: {
          departure_airport: 'PDX',
          arrival_airport: 'MDW',
          departure_local_time: '07:15',
          arrival_local_time: '13:05',
        },
      }),
      makeItem({
        provider: 'Southwest',
        start_date: '2026-03-20',
        end_date: '2026-03-20',
        start_ts: '2026-03-20T14:40:00-05:00',
        end_ts: '2026-03-20T17:55:00-04:00',
        start_location: 'MDW',
        end_location: 'CHS',
        details_json: {
          departure_airport: 'MDW',
          arrival_airport: 'CHS',
          departure_local_time: '14:40',
          arrival_local_time: '17:55',
        },
      }),
      makeItem({
        kind: 'hotel',
        start_date: '2026-03-20',
        end_date: '2026-03-22',
        start_location: 'The Vendue, Charleston, SC',
        summary: 'The Vendue',
      }),
      makeItem({
        provider: 'JetBlue',
        start_date: '2026-03-22',
        end_date: '2026-03-22',
        start_ts: '2026-03-22T10:00:00-04:00',
        end_ts: '2026-03-22T12:15:00-04:00',
        start_location: 'CHS',
        end_location: 'JFK',
        details_json: {
          departure_airport: 'CHS',
          arrival_airport: 'JFK',
          departure_local_time: '10:00',
          arrival_local_time: '12:15',
        },
      }),
      makeItem({
        provider: 'Neos',
        start_date: '2026-03-22',
        end_date: '2026-03-23',
        start_ts: '2026-03-22T15:10:00-04:00',
        end_ts: '2026-03-23T05:45:00+01:00',
        start_location: 'EWR',
        end_location: 'MXP',
        details_json: {
          departure_airport: 'EWR',
          arrival_airport: 'MXP',
          departure_local_time: '15:10',
          arrival_local_time: '05:45',
        },
      }),
    ]

    const timeline = buildTimeline(items)
    const transitions = timeline.filter((entry) => entry.type === 'transition')
    const segments = timeline.filter((entry) => entry.type === 'segment')

    expect(segments).toHaveLength(6)
    expect(transitions).toHaveLength(6)
    expect(segments.map((entry) => entry.segment?.city)).toEqual([
      'Surfside, Florida',
      'New York',
      'Austin, TX',
      'Portland, OR',
      'Charleston, SC',
      'Milan',
    ])

    expect(transitions.map((entry) => entry.nextSegmentCity)).toEqual([
      'Surfside, Florida',
      'New York',
      'Austin, TX',
      'Portland, OR',
      'Charleston, SC',
      'Milan',
    ])

    expect(timeline.some((entry) => entry.type === 'segment' && entry.segment?.city.includes('Paris'))).toBe(false)
    expect(timeline.some((entry) => entry.type === 'segment' && entry.segment?.city.includes('DFW'))).toBe(false)
    expect(timeline.some((entry) => entry.type === 'segment' && entry.segment?.city.includes('MDW'))).toBe(false)
    expect(timeline.some((entry) => entry.type === 'segment' && entry.segment?.city.includes('JFK'))).toBe(false)

    expect(transitions[3].transition?.departure.code).toBe('AUS')
    expect(transitions[3].transition?.arrival.code).toBe('PDX')
    expect(transitions[3].transition?.stopCodes).toEqual(['DFW'])

    expect(transitions[5].transition?.departure.code).toBe('CHS')
    expect(transitions[5].transition?.arrival.code).toBe('MXP')
    expect(transitions[5].transition?.stopCodes).toEqual(['JFK', 'EWR'])

    expect(segments[0].segment?.city).not.toContain('Grand Beach Hotel Surfside')
    expect(segments[2].segment?.city).toContain('Austin')
    expect(segments[2].segment?.city).not.toContain('Stephen F Austin')
    expect(segments[5].segment?.durationNights).toBe(0)
  })
})

describe('hotel segment assignment', () => {
  it('moves hotel with check-in on departure day to destination segment', () => {
    // Scenario: staying in NYC (no hotel), then flying to Austin where you have a hotel
    // Hotel check-in date == flight departure date
    const items: TripItem[] = [
      // Flight arriving in NYC
      makeItem({
        provider: 'Spirit',
        start_date: '2026-03-10',
        end_date: '2026-03-10',
        start_location: 'MIA',
        end_location: 'EWR',
        details_json: {
          departure_airport: 'MIA',
          arrival_airport: 'EWR',
          departure_local_time: '06:00',
          arrival_local_time: '09:30',
        },
      }),
      // Hotel in Austin — check-in same day as flight out of NYC
      // Location is just the hotel name (no city)
      makeItem({
        kind: 'hotel',
        start_date: '2026-03-13',
        end_date: '2026-03-14',
        start_location: 'The Stephen F Austin Royal Sonesta Hotel',
        summary: 'Hotel booking',
      }),
      // Flight from NYC to Austin
      makeItem({
        provider: 'Spirit',
        start_date: '2026-03-13',
        end_date: '2026-03-13',
        start_location: 'EWR',
        end_location: 'AUS',
        details_json: {
          departure_airport: 'EWR',
          arrival_airport: 'AUS',
          departure_local_time: '09:00',
          arrival_local_time: '12:15',
        },
      }),
    ]

    const timeline = buildTimeline(items)
    const segments = timeline.filter((e) => e.type === 'segment')

    // NYC segment should NOT contain the Austin hotel
    const nycSegment = segments.find((e) => e.segment?.city === 'New York')
    expect(nycSegment).toBeDefined()
    expect(nycSegment!.segment!.items.some((i) => i.kind === 'hotel')).toBe(false)

    // Austin segment should contain the hotel
    const austinSegment = segments.find((e) => e.segment?.city?.includes('Austin'))
    expect(austinSegment).toBeDefined()
    expect(austinSegment!.segment!.items.some((i) => i.kind === 'hotel')).toBe(true)
  })

  it('keeps hotel in departure segment when hotel city matches departure city', () => {
    // Scenario: hotel in NYC with same-day evening flight (rare but valid)
    const items: TripItem[] = [
      makeItem({
        provider: 'Delta',
        start_date: '2026-03-10',
        end_date: '2026-03-10',
        start_location: 'LAX',
        end_location: 'JFK',
        details_json: {
          departure_airport: 'LAX',
          arrival_airport: 'JFK',
          departure_local_time: '06:00',
          arrival_local_time: '14:30',
        },
      }),
      // Hotel in NYC — check-in same day as flight out, but hotel IS in NYC
      makeItem({
        kind: 'hotel',
        start_date: '2026-03-12',
        end_date: '2026-03-13',
        start_location: 'The Plaza Hotel, New York, NY',
        summary: 'Hotel in NYC',
      }),
      makeItem({
        provider: 'Delta',
        start_date: '2026-03-12',
        end_date: '2026-03-12',
        start_location: 'JFK',
        end_location: 'ORD',
        details_json: {
          departure_airport: 'JFK',
          arrival_airport: 'ORD',
          departure_local_time: '20:00',
          arrival_local_time: '22:00',
        },
      }),
    ]

    const timeline = buildTimeline(items)
    const segments = timeline.filter((e) => e.type === 'segment')

    // NYC segment should keep the hotel (it's clearly a NYC hotel)
    const nycSegment = segments.find((e) => e.segment?.city?.includes('New York'))
    expect(nycSegment).toBeDefined()
    expect(nycSegment!.segment!.items.some((i) => i.kind === 'hotel')).toBe(true)
  })

  it('works when traveler has no hotels (staying with friends)', () => {
    const items: TripItem[] = [
      makeItem({
        provider: 'Delta',
        start_date: '2026-03-10',
        end_date: '2026-03-10',
        start_location: 'CDG',
        end_location: 'JFK',
        details_json: {
          departure_airport: 'CDG',
          arrival_airport: 'JFK',
          departure_local_time: '10:00',
          arrival_local_time: '13:00',
        },
      }),
      // No hotel — staying with friends in NYC
      // Just an activity
      makeItem({
        kind: 'activity',
        start_date: '2026-03-11',
        end_date: '2026-03-11',
        start_location: 'Brooklyn, NY',
        summary: 'Dinner with friends',
      }),
      makeItem({
        provider: 'Delta',
        start_date: '2026-03-14',
        end_date: '2026-03-14',
        start_location: 'JFK',
        end_location: 'CDG',
        details_json: {
          departure_airport: 'JFK',
          arrival_airport: 'CDG',
          departure_local_time: '18:00',
          arrival_local_time: '07:00',
        },
      }),
    ]

    const timeline = buildTimeline(items)
    const segments = timeline.filter((e) => e.type === 'segment')

    // Segment should exist with activity-derived city, even without hotel
    // Brooklyn is a valid city from the activity location
    const nycSegment = segments.find((e) => e.segment?.city?.includes('Brooklyn'))
    expect(nycSegment).toBeDefined()
    expect(nycSegment!.segment!.items).toHaveLength(1) // just the activity
    expect(nycSegment!.segment!.anchorType).toBe('activity')
  })
})

  it('keeps hotel in same metro area as departure (Coconut Grove / MIA)', () => {
    // Same-day check-in + departure, but hotel is in departure metro area
    const items: TripItem[] = [
      makeItem({
        provider: 'Delta',
        start_date: '2026-03-10',
        end_date: '2026-03-10',
        start_location: 'ATL',
        end_location: 'MIA',
        details_json: {
          departure_airport: 'ATL',
          arrival_airport: 'MIA',
          departure_local_time: '06:00',
          arrival_local_time: '09:00',
        },
      }),
      makeItem({
        kind: 'hotel',
        start_date: '2026-03-10',
        end_date: '2026-03-11',
        start_location: 'Mr. C Hotel, Coconut Grove, FL',
        summary: 'Hotel in Coconut Grove',
      }),
      makeItem({
        provider: 'Delta',
        start_date: '2026-03-10',
        end_date: '2026-03-10',
        start_location: 'MIA',
        end_location: 'LAX',
        details_json: {
          departure_airport: 'MIA',
          arrival_airport: 'LAX',
          departure_local_time: '22:00',
          arrival_local_time: '01:00',
        },
      }),
    ]

    const timeline = buildTimeline(items)
    const segments = timeline.filter((e) => e.type === 'segment')

    // Hotel should stay in the Miami/Coconut Grove segment (same metro)
    const miaSegment = segments.find((e) =>
      e.segment?.city?.includes('Coconut Grove') || e.segment?.city?.includes('Miami')
    )
    expect(miaSegment).toBeDefined()
    expect(miaSegment!.segment!.items.some((i) => i.kind === 'hotel')).toBe(true)
  })
