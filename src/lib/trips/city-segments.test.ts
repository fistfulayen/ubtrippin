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
        start_location: 'Austin, TX',
        summary: 'The Stephen F Austin Royal Sonesta Hotel',
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
