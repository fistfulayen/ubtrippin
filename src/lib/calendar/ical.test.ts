import type { Trip, TripItem } from '@/types/database'

import { generateFeedICal, generateTripICal } from './ical'

function createTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    user_id: 'user-1',
    title: 'Paris Trip',
    start_date: '2026-03-01',
    end_date: '2026-03-05',
    primary_location: 'Paris',
    travelers: ['Alice'],
    notes: null,
    cover_image_url: null,
    share_token: null,
    share_enabled: false,
    created_at: '2026-02-01T00:00:00.000Z',
    updated_at: '2026-02-01T00:00:00.000Z',
    ...overrides,
  }
}

function createTripItem(overrides: Partial<TripItem> = {}): TripItem {
  return {
    id: 'item-1',
    user_id: 'user-1',
    trip_id: 'trip-1',
    kind: 'flight',
    provider: 'Air France',
    confirmation_code: 'AFCONF1',
    traveler_names: ['Alice'],
    start_ts: '2026-03-01T09:45:00.000Z',
    end_ts: '2026-03-01T12:05:00.000Z',
    start_date: '2026-03-01',
    end_date: '2026-03-01',
    start_location: 'CDG',
    end_location: 'JFK',
    summary: 'AF11 Paris to New York',
    details_json: {
      airline: 'Air France',
      flight_number: 'AF11',
      departure_airport: 'CDG',
      arrival_airport: 'JFK',
      departure_terminal: '2E',
      departure_gate: 'L21',
      arrival_terminal: '4',
      arrival_gate: 'B39',
      departure_local_time: '10:45',
      arrival_local_time: '13:05',
      booking_reference: 'BOOK123',
    },
    status: 'confirmed',
    confidence: 0.9,
    needs_review: false,
    loyalty_flag: null,
    source_email_id: null,
    created_at: '2026-02-01T00:00:00.000Z',
    updated_at: '2026-02-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('generateTripICal', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-28T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns valid VCALENDAR output wrapper', () => {
    const ics = generateTripICal(createTrip(), [createTripItem()])

    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('VERSION:2.0')
    expect(ics).toContain('PRODID:-//UB Trippin//Travel Calendar//EN')
    expect(ics).toContain('END:VCALENDAR')
  })

  it('includes trip span all-day VEVENT', () => {
    const ics = generateTripICal(createTrip(), [createTripItem()])

    expect(ics).toContain('UID:trip-trip-1@ubtrippin.xyz')
    expect(ics).toContain('DTSTART;VALUE=DATE:20260301')
    expect(ics).toContain('DTEND;VALUE=DATE:20260306')
  })

  it('emits DTSTART/DTEND with airport timezone for flights with local times', () => {
    const ics = generateTripICal(createTrip(), [createTripItem()])

    expect(ics).toContain('DTSTART;TZID=Europe/Paris:20260301T104500')
    expect(ics).toContain('DTEND;TZID=America/New_York:20260301T130500')
  })

  it('falls back to UTC-derived floating datetime when airport timezone is unknown', () => {
    const item = createTripItem({
      start_location: 'ZZZ',
      end_location: 'YYY',
      details_json: {
        flight_number: 'ZZ123',
        departure_airport: 'ZZZ',
        arrival_airport: 'YYY',
      },
    })

    const ics = generateTripICal(createTrip(), [item])

    expect(ics).toContain('DTSTART:20260301T094500')
    expect(ics).toContain('DTEND:20260301T120500')
  })

  it('includes rich flight details in DESCRIPTION', () => {
    const ics = generateTripICal(createTrip(), [createTripItem()])

    expect(ics).toContain('DESCRIPTION:Air France AF11')
    expect(ics).toContain('Departs: CDG')
    expect(ics).toContain('Terminal 2E')
    expect(ics).toContain('Gate L21')
    expect(ics).toContain('Arrives: JFK')
    expect(ics).toContain('Confirmation: AFCONF1')
  })

  it('generates one VEVENT for trip span plus one for each item', () => {
    const itemA = createTripItem({ id: 'item-a' })
    const itemB = createTripItem({
      id: 'item-b',
      kind: 'hotel',
      start_date: '2026-03-02',
      end_date: '2026-03-04',
      details_json: {
        hotel_name: 'Htel de Paris',
        address: '1 Rue de Rivoli, Paris',
      },
    })

    const ics = generateTripICal(createTrip(), [itemA, itemB])
    const eventCount = (ics.match(/BEGIN:VEVENT/g) ?? []).length

    expect(eventCount).toBe(3)
  })

  it('sets DTSTAMP timestamps in UTC Zulu format', () => {
    const ics = generateTripICal(createTrip(), [createTripItem()])

    expect(ics).toContain('DTSTAMP:20260228T120000Z')
  })
})

describe('generateFeedICal', () => {
  it('includes VEVENTs for multiple trips and their items', () => {
    const tripA = createTrip({ id: 'trip-a', title: 'Trip A', start_date: '2026-03-01', end_date: '2026-03-02' })
    const tripB = createTrip({ id: 'trip-b', title: 'Trip B', start_date: '2026-04-01', end_date: '2026-04-02' })

    const itemA = createTripItem({ id: 'item-a', trip_id: 'trip-a' })
    const itemB = createTripItem({ id: 'item-b', trip_id: 'trip-b', provider: 'Delta', summary: 'DL1' })

    const ics = generateFeedICal([tripA, tripB], [
      { ...itemA, trip: tripA },
      { ...itemB, trip: tripB },
    ])

    expect(ics).toContain('UID:trip-trip-a@ubtrippin.xyz')
    expect(ics).toContain('UID:trip-trip-b@ubtrippin.xyz')
    expect(ics).toContain('UID:item-a@ubtrippin.xyz')
    expect(ics).toContain('UID:item-b@ubtrippin.xyz')
  })
})
