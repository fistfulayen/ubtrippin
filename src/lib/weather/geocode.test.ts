import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearGeocodeCache, geocodeCity } from './geocode'

describe('geocodeCity', () => {
  afterEach(() => {
    clearGeocodeCache()
    vi.unstubAllGlobals()
  })

  it('picks the result matching query hints and caches it', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { name: 'Portland', admin1: 'Maine', country: 'United States', latitude: 43.66, longitude: -70.25, population: 68000 },
          { name: 'Portland', admin1: 'Oregon', country: 'United States', latitude: 45.52, longitude: -122.67, population: 650000 },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await geocodeCity('Portland, Oregon, United States')
    const cached = await geocodeCity('Portland, Oregon, United States')

    expect(result?.admin1).toBe('Oregon')
    expect(cached?.admin1).toBe('Oregon')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
