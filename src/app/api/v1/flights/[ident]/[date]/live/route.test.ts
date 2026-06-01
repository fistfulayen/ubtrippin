import { afterEach, describe, expect, it, vi } from 'vitest'

describe('GET /api/v1/flights/:ident/:date/live', () => {
  const originalApiKey = process.env.FLIGHTAWARE_API_KEY

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.resetModules()
    if (originalApiKey === undefined) {
      delete process.env.FLIGHTAWARE_API_KEY
    } else {
      process.env.FLIGHTAWARE_API_KEY = originalApiKey
    }
  })

  it('returns a pending response for future flights FlightAware has not published yet', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T21:00:00Z'))
    process.env.FLIGHTAWARE_API_KEY = 'test-key'

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ flights: [] }),
    }))

    const { GET } = await import('./route')
    const response = await GET(
      new Request('https://example.com/api/v1/flights/LX633/2026-06-22/live'),
      { params: Promise.resolve({ ident: 'LX633', date: '2026-06-22' }) }
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      upstream_status: 'pending',
      flight: {
        ident: 'LX633',
        status: 'unknown',
        origin: { code: 'TBD' },
        destination: { code: 'TBD' },
      },
    })
  })
})
