import { describe, expect, it, vi } from 'vitest'
import { fetchForecast, isTripWithinForecastWindow } from './forecast'

describe('isTripWithinForecastWindow', () => {
  it('returns false for trips beyond the 16-day forecast window', () => {
    const future = new Date()
    future.setUTCDate(future.getUTCDate() + 20)
    expect(isTripWithinForecastWindow(future.toISOString().slice(0, 10))).toBe(false)
  })
})

describe('fetchForecast', () => {
  it('returns an empty array when the trip starts beyond the forecast window', async () => {
    const future = new Date()
    future.setUTCDate(future.getUTCDate() + 20)

    const result = await fetchForecast({
      latitude: 1,
      longitude: 2,
      unit: 'fahrenheit',
      dateStart: future.toISOString().slice(0, 10),
      dateEnd: future.toISOString().slice(0, 10),
    })

    expect(result).toEqual([])
  })

  it('maps Open-Meteo daily data into forecast days', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        daily: {
          time: ['2026-03-10'],
          temperature_2m_max: [72],
          temperature_2m_min: [55],
          precipitation_sum: [1.2],
          precipitation_probability_max: [40],
          weathercode: [2],
          wind_speed_10m_max: [12],
        },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const today = new Date().toISOString().slice(0, 10)
    const result = await fetchForecast({
      latitude: 1,
      longitude: 2,
      unit: 'fahrenheit',
      dateStart: today,
      dateEnd: today,
    })

    expect(result[0]).toMatchObject({
      date: '2026-03-10',
      temp_high: 72,
      temp_low: 55,
      precipitation_probability: 40,
      weather_description: 'Partly cloudy',
    })
  })
})
