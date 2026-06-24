import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildFlightAwareDateWindow, getFlightStatus, pickBestFlight } from './flight-status'

describe('buildFlightAwareDateWindow', () => {
  it('builds a valid 36-hour lookup window for future flight dates', () => {
    expect(buildFlightAwareDateWindow('2026-06-22')).toEqual({
      start: '2026-06-22T00:00:00Z',
      end: '2026-06-23T12:00:00Z',
    })
  })
})

describe('getFlightStatus', () => {
  const originalApiKey = process.env.FLIGHTAWARE_API_KEY

  afterEach(() => {
    vi.unstubAllGlobals()
    if (originalApiKey === undefined) {
      delete process.env.FLIGHTAWARE_API_KEY
    } else {
      process.env.FLIGHTAWARE_API_KEY = originalApiKey
    }
  })

  it('queries FlightAware with the requested future date window', async () => {
    process.env.FLIGHTAWARE_API_KEY = 'test-key'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        flights: [
          {
            ident: 'LX633',
            ident_iata: 'LX633',
            status: 'Scheduled',
            scheduled_out: '2026-06-22T10:00:00Z',
            estimated_out: '2026-06-22T10:00:00Z',
            scheduled_on: '2026-06-22T12:00:00Z',
            estimated_on: '2026-06-22T12:00:00Z',
            cancelled: false,
            diverted: false,
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await getFlightStatus('LX633', '2026-06-22')

    expect(result?.status).toBe('on_time')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://aeroapi.flightaware.com/aeroapi/flights/LX633?start=2026-06-22T00%3A00%3A00Z&end=2026-06-23T12%3A00%3A00Z',
      {
        headers: { 'x-apikey': 'test-key' },
        cache: 'no-store',
      }
    )
  })

  it('uses the requested date instead of tomorrow when FlightAware returns multiple recurring flights', async () => {
    process.env.FLIGHTAWARE_API_KEY = 'test-key'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        flights: [
          {
            ident: 'AZ571',
            ident_iata: 'AZ571',
            status: 'Scheduled',
            scheduled_out: '2026-06-24T08:55:00Z',
            estimated_out: '2026-06-24T09:15:00Z',
            scheduled_on: '2026-06-24T10:25:00Z',
            estimated_on: '2026-06-24T10:45:00Z',
            cancelled: false,
            diverted: false,
          },
          {
            ident: 'AZ571',
            ident_iata: 'AZ571',
            status: 'Scheduled',
            scheduled_out: '2026-06-25T08:55:00Z',
            estimated_out: '2026-06-25T08:55:00Z',
            scheduled_on: '2026-06-25T10:25:00Z',
            estimated_on: '2026-06-25T10:25:00Z',
            cancelled: false,
            diverted: false,
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await getFlightStatus('AZ571', '2026-06-24')

    expect(result?.status).toBe('delayed')
    expect(result?.delayMinutes).toBe(20)
    expect(result?.estimatedDeparture).toBe('2026-06-24T09:15:00Z')
  })
})

describe('pickBestFlight', () => {
  it('prefers the matching itinerary date over a later not-landed occurrence', () => {
    const flight = pickBestFlight(
      [
        {
          ident: 'AZ571',
          scheduled_out: '2026-06-24T08:55:00Z',
          estimated_out: '2026-06-24T09:15:00Z',
        },
        {
          ident: 'AZ571',
          scheduled_out: '2026-06-25T08:55:00Z',
          estimated_out: '2026-06-25T08:55:00Z',
        },
      ],
      { date: '2026-06-24' }
    )

    expect(flight?.estimated_out).toBe('2026-06-24T09:15:00Z')
  })
})
