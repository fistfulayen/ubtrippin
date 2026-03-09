import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EventCard, getEventCardClasses } from './event-card'
import type { CityEvent } from '@/types/events'

const baseEvent: CityEvent = {
  id: 'event-1',
  city_id: 'city-1',
  venue_id: null,
  parent_event_id: null,
  title: 'Spring Biennale',
  venue_name: 'Grand Palais',
  venue_type: 'museum',
  category: 'art',
  event_tier: 'major',
  description: 'A major exhibition.',
  start_date: '2026-03-12',
  end_date: '2026-03-22',
  time_info: '10:00-18:00',
  significance_score: 92,
  source: 'Tourism Board',
  source_url: 'https://example.com/events/spring-biennale',
  image_url: 'https://example.com/event.jpg',
  price_info: 'From €20',
  booking_url: 'https://example.com/tickets',
  tags: ['art'],
  lineup: null,
  last_verified_at: null,
  expires_at: null,
}

describe('EventCard', () => {
  it('renders major events with featured treatment', () => {
    const html = renderToStaticMarkup(React.createElement(EventCard, { event: baseEvent }))
    expect(getEventCardClasses(baseEvent)).toContain('bg-white')
    expect(html).toContain('Featured')
    expect(html).toContain('View Details')
  })

  it('renders medium events with horizontal styling classes', () => {
    const event = { ...baseEvent, event_tier: 'medium' as const }
    const html = renderToStaticMarkup(React.createElement(EventCard, { event }))
    expect(getEventCardClasses(event)).toContain('bg-slate-50/70')
    expect(html).not.toContain('Featured')
  })

  it('renders local sacred events with compact indigo styling', () => {
    const event = {
      ...baseEvent,
      event_tier: 'local' as const,
      venue_type: 'sacred_venue' as const,
    }
    const html = renderToStaticMarkup(React.createElement(EventCard, { event }))
    expect(getEventCardClasses(event)).toContain('border-indigo-100')
    expect(html).toContain('Sacred Venue')
  })
})
