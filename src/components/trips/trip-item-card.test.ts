import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./flight-item-card', () => ({
  FlightItemCard: ({ defaultExpanded }: { defaultExpanded?: boolean }) =>
    React.createElement('div', null, defaultExpanded ? 'expanded' : 'collapsed'),
}))

import { TripItemCard } from './trip-item-card'
import type { TripItem, Trip } from '@/types/database'

function buildFlightItem(overrides: Partial<TripItem> = {}): TripItem {
  return {
    id: 'item-1',
    user_id: 'user-1',
    trip_id: 'trip-1',
    kind: 'flight',
    provider: 'Etihad',
    confirmation_code: 'ABC123',
    traveler_names: [],
    start_ts: '2026-06-30T08:00:00.000Z',
    end_ts: '2026-06-30T10:00:00.000Z',
    start_date: '2026-06-30',
    end_date: '2026-06-30',
    start_location: 'Abu Dhabi',
    end_location: 'Paris',
    summary: 'EY123',
    details_json: {
      flight_number: 'EY123',
      airline: 'Etihad',
    },
    status: 'confirmed',
    confidence: 1,
    needs_review: false,
    loyalty_flag: null,
    source_email_id: null,
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    ...overrides,
  }
}

function buildTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    user_id: 'user-1',
    title: 'Paris',
    start_date: '2026-06-30',
    end_date: '2026-07-03',
    primary_location: 'Paris, France',
    travelers: [],
    notes: null,
    cover_image_url: null,
    is_demo: false,
    share_token: null,
    share_enabled: false,
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('TripItemCard', () => {
  it('passes defaultExpanded through to the flight card', () => {
    const html = renderToStaticMarkup(
      React.createElement(TripItemCard, {
        item: buildFlightItem(),
        allTrips: [buildTrip()],
        defaultExpanded: true,
      })
    )

    expect(html).toContain('expanded')
  })

  it('keeps flight cards collapsed when defaultExpanded is false', () => {
    const html = renderToStaticMarkup(
      React.createElement(TripItemCard, {
        item: buildFlightItem(),
        allTrips: [buildTrip()],
        defaultExpanded: false,
      })
    )

    expect(html).toContain('collapsed')
  })
})
