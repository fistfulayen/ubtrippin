import { describe, expect, it } from 'vitest'
import { getPrimaryLocation } from './assignment'
import type { ExtractedItem } from '@/lib/ai/extract-travel-data'

function makeItem(overrides: Partial<ExtractedItem>): ExtractedItem {
  return {
    kind: 'flight',
    provider: null,
    confirmation_code: null,
    traveler_names: [],
    start_date: '2026-04-01',
    end_date: null,
    start_ts: null,
    end_ts: null,
    start_location: null,
    end_location: null,
    summary: null,
    status: 'confirmed',
    confidence: 1,
    needs_review: false,
    details: {},
    ...overrides,
  }
}

describe('getPrimaryLocation', () => {
  it('returns null for empty items', () => {
    expect(getPrimaryLocation([])).toBeNull()
  })

  it('prefers hotel location over flights', () => {
    const items = [
      makeItem({ kind: 'flight', start_location: 'Paris CDG', end_location: 'Tokyo NRT' }),
      makeItem({ kind: 'hotel', start_location: 'Tokyo, Japan' }),
      makeItem({ kind: 'flight', start_location: 'Tokyo NRT', end_location: 'Paris CDG' }),
    ]
    expect(getPrimaryLocation(items)).toBe('Tokyo, Japan')
  })

  it('does not use hotel name as city ("The Vendue, Charleston, SC")', () => {
    const items = [
      makeItem({ kind: 'flight', start_location: 'Paris CDG', end_location: 'Charleston' }),
      makeItem({ kind: 'hotel', start_location: 'The Vendue, Charleston, SC' }),
      makeItem({ kind: 'activity', start_location: 'Charleston' }),
    ]
    const result = getPrimaryLocation(items)
    expect(result).not.toContain('Vendue')
    expect(result).toContain('Charleston')
  })

  it('handles multi-city trip — picks most common hotel city', () => {
    const items = [
      makeItem({ kind: 'hotel', start_location: 'Austin, TX' }),
      makeItem({ kind: 'hotel', start_location: 'Austin, TX' }),
      makeItem({ kind: 'hotel', start_location: 'Milan, Italy' }),
    ]
    expect(getPrimaryLocation(items)).toBe('Austin, TX')
  })

  it('uses activities/restaurants when no hotels', () => {
    const items = [
      makeItem({ kind: 'flight', start_location: 'JFK', end_location: 'LAX' }),
      makeItem({ kind: 'restaurant', start_location: 'Los Angeles' }),
      makeItem({ kind: 'activity', start_location: 'Los Angeles' }),
    ]
    const result = getPrimaryLocation(items)
    expect(result).toContain('Los Angeles')
  })

  it('falls back to flight destinations when nothing else', () => {
    const items = [
      makeItem({ kind: 'flight', start_location: 'CDG', end_location: 'Tokyo NRT' }),
    ]
    expect(getPrimaryLocation(items)).toBe('Tokyo')
  })

  it('ignores layover cities in favor of destination', () => {
    // NYC → Atlanta (connection) → SF: hotel is in SF
    const items = [
      makeItem({ kind: 'flight', start_location: 'New York JFK', end_location: 'Atlanta' }),
      makeItem({ kind: 'flight', start_location: 'Atlanta', end_location: 'San Francisco SFO' }),
      makeItem({ kind: 'hotel', start_location: 'San Francisco, CA' }),
    ]
    const result = getPrimaryLocation(items)
    expect(result).toContain('San Francisco')
  })

  it('strips airport codes from locations', () => {
    const items = [
      makeItem({ kind: 'flight', end_location: 'New York JFK' }),
    ]
    expect(getPrimaryLocation(items)).toBe('New York')
  })

  it('strips parenthesized airport codes — "New York (JFK)" → "New York"', () => {
    const items = [
      makeItem({ kind: 'flight', end_location: 'New York (JFK)' }),
    ]
    expect(getPrimaryLocation(items)).toBe('New York')
  })

  it('does not mangle multi-word city names — "New York City, NY" stays "New York City, NY"', () => {
    const items = [
      makeItem({ kind: 'hotel', start_location: 'New York City, NY' }),
    ]
    const result = getPrimaryLocation(items)
    // Must not silently collapse to "NY"
    expect(result).not.toBe('NY')
    expect(result).toContain('New York City')
  })

  it('does not mangle "Salt Lake City, UT" to "UT"', () => {
    const items = [
      makeItem({ kind: 'hotel', start_location: 'Salt Lake City, UT' }),
    ]
    const result = getPrimaryLocation(items)
    expect(result).not.toBe('UT')
    expect(result).toContain('Salt Lake City')
  })
})
