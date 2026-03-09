import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({})),
}))

vi.mock('@/lib/events/queries', () => ({
  getCityEventsPageData: vi.fn(async () => ({
    city: { id: 'city-1', city: 'Paris', country: 'France', country_code: 'FR', slug: 'paris', latitude: null, longitude: null, timezone: null, hero_image_url: null, last_refreshed_at: null },
    events: [],
    segments: [],
    distanceGroups: [],
    pipelineDiary: null,
  })),
}))

import { GET, validateEventsQuery } from './route'

describe('validateEventsQuery', () => {
  it('rejects invalid date formats', () => {
    expect(() => validateEventsQuery(new URLSearchParams('city=paris&from=2026/03/01'))).toThrow(
      '"from" must be YYYY-MM-DD.'
    )
  })

  it('parses valid filters', () => {
    expect(validateEventsQuery(new URLSearchParams('city=paris&from=2026-03-01&tier=major'))).toEqual({
      city: 'paris',
      from: '2026-03-01',
      to: undefined,
      tier: 'major',
      category: undefined,
    })
  })
})

describe('GET /api/v1/events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 for invalid query params', async () => {
    const request = new NextRequest('https://example.com/api/v1/events?city=paris&from=bad-date')
    const response = await GET(request)
    expect(response.status).toBe(400)
  })

  it('rate limits repeated requests from the same caller', async () => {
    let response = null
    for (let index = 0; index < 101; index += 1) {
      const request = new NextRequest('https://example.com/api/v1/events?city=paris', {
        headers: { 'x-forwarded-for': '203.0.113.50' },
      })
      response = await GET(request)
    }

    expect(response?.status).toBe(429)
  })
})
