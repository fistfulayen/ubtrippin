import { describe, expect, it } from 'vitest'
import { buildSegmentHref } from './event-filter-bar'

describe('buildSegmentHref', () => {
  it('removes the segment param for the all-events chip', () => {
    const params = new URLSearchParams('from=2026-03-01&segment=music')
    expect(buildSegmentHref('/cities/paris', params, undefined)).toBe('/cities/paris?from=2026-03-01')
  })

  it('sets the active segment while preserving the rest of the query string', () => {
    const params = new URLSearchParams('from=2026-03-01&to=2026-03-07')
    expect(buildSegmentHref('/cities/paris', params, 'art')).toBe('/cities/paris?from=2026-03-01&to=2026-03-07&segment=art')
  })
})
