import { describe, expect, it } from 'vitest'

import type { Trip, TripItem } from '@/types/database'
import { generateFeedICal, generateTripICal } from './ical'

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    user_id: 'user-1',
    title: 'Paris Trip',
    start_date: '2026-06-01',
    end_date: '2026-06-10',
    primary_location: 'Paris, France',
    travelers: ['Alex'],
    notes: null,
    cover_image_url: null,
    share_token: null,
    share_enabled: false,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeItem(overrides: Partial<TripItem> = {}): TripItem {
  return {
    id: 'item-1',
    user_id: 'user-1',
    trip_id: 'trip-1',
    kind: 'flight',
    provider: 'Air France',
    confirmation_code: 'ABC123',
    traveler_names: ['Alex'],
    start_ts: '2026-06-01T08:00:00.000Z',
    end_ts: '2026-06-01T12:00:00.000Z',
    start_date: '2026-06-01',
    end_date: '2026-06-01',
    start_location: 'CDG',
    end_location: 'JFK',
    summary: null,
    details_json: {},
    status: 'confirmed',
    confidence: 0.9,
    needs_review: false,
    loyalty_flag: null,
    source_email_id: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('generateTripICal', () => {
  it('produces valid VCALENDAR wrapper', () => {
    const ics = generateTripICal(makeTrip(), [])
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics).toContain('VERSION:2.0')
  })

  it('includes DTSTAMP in UTC format', () => {
    const ics = generateTripICal(makeTrip(), [])
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/)
  })

  it('includes DTSTART and DTEND for flight event', () => {
    const item = makeItem({
      details_json: {
        flight_number: 'AF1234',
        airline: 'Air France',
        departure_airport: 'CDG',
        arrival_airport: 'JFK',
        departure_local_time: '10:30',
        arrival_local_time: '13:10',
      },
    })

    const ics = generateTripICal(makeTrip(), [item])
    expect(ics).toContain('DTSTART')
    expect(ics).toContain('DTEND')
  })

  it('includes rich flight details in DESCRIPTION', () => {
    const item = makeItem({
      details_json: {
        flight_number: 'AF1234',
        airline: 'Air France',
        departure_airport: 'CDG',
        arrival_airport: 'JFK',
        departure_terminal: '2E',
        arrival_terminal: '4',
        departure_gate: 'K21',
        arrival_gate: 'B12',
        departure_local_time: '10:30',
        arrival_local_time: '13:10',
      },
    })

    const ics = generateTripICal(makeTrip(), [item])
    expect(ics).toContain('DESCRIPTION:Air France AF1234')
    expect(ics).toContain('Terminal 2E')
    expect(ics).toContain('Gate K21')
    expect(ics).toContain('Confirmation: ABC123')
  })

  it('creates multiple VEVENT blocks for multiple items', () => {
    const items = [
      makeItem({ id: 'item-1', start_date: '2026-06-01' }),
      makeItem({ id: 'item-2', start_date: '2026-06-02' }),
    ]

    const ics = generateTripICal(makeTrip(), items)
    const eventCount = (ics.match(/BEGIN:VEVENT/g) ?? []).length
    expect(eventCount).toBe(3)
  })

  it('emits floating datetime from UTC timestamps when airport timezone is unknown', () => {
    const item = makeItem({
      start_location: 'ZZZ',
      end_location: 'YYY',
      details_json: {
        flight_number: 'ZZ100',
      },
      start_ts: '2026-06-01T08:15:00.000Z',
      end_ts: '2026-06-01T09:45:00.000Z',
    })

    const ics = generateTripICal(makeTrip(), [item])
    expect(ics).toContain('DTSTART:20260601T081500')
    expect(ics).toContain('DTEND:20260601T094500')
  })
})

describe('generateFeedICal', () => {
  it('creates events across multiple trips', () => {
    const trips = [makeTrip({ id: 'trip-1' }), makeTrip({ id: 'trip-2', title: 'Tokyo Trip' })]
    const items = [
      makeItem({ id: 'item-1', trip_id: 'trip-1' }),
      makeItem({ id: 'item-2', trip_id: 'trip-2', start_date: '2026-07-01' }),
    ]

    const ics = generateFeedICal(trips, items)
    const eventCount = (ics.match(/BEGIN:VEVENT/g) ?? []).length
    expect(eventCount).toBe(4)
  })
})
