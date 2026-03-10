import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => React.createElement('a', { href }, children),
}))

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => React.createElement('img', props),
}))

import { TripCard, getTripCardPlaceholderLabel } from './trip-card'
import type { Trip } from '@/types/database'

function buildTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    user_id: 'user-1',
    title: 'Chicago → Tokyo',
    start_date: '2026-03-17',
    end_date: '2026-03-22',
    primary_location: 'Tokyo, Japan',
    notes: null,
    travelers: ['Traveler'],
    cover_image_url: null,
    created_at: '2026-03-10T00:00:00.000Z',
    updated_at: '2026-03-10T00:00:00.000Z',
    is_demo: true,
    share_token: null,
    share_enabled: false,
    ...overrides,
  }
}

describe('TripCard placeholder', () => {
  it('prefers the primary location for the fallback hero label', () => {
    expect(getTripCardPlaceholderLabel(buildTrip())).toBe('Tokyo, Japan')
  })

  it('falls back to the destination segment from the title', () => {
    expect(
      getTripCardPlaceholderLabel(
        buildTrip({
          primary_location: null,
          title: 'Chicago → Tokyo',
        })
      )
    ).toBe('Tokyo')
  })

  it('renders an intentional placeholder when the trip has no cover image', () => {
    const html = renderToStaticMarkup(
      React.createElement(TripCard, {
        trip: buildTrip(),
        itemCount: 3,
      })
    )

    expect(html).toContain('No cover photo')
    expect(html).toContain('Tokyo, Japan')
    expect(html).toContain('Sample itinerary')
  })
})
