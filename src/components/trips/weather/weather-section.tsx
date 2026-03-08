'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime } from '@/lib/utils'
import type { WeatherResponsePayload } from '@/lib/weather/types'
import { CityWeatherCard } from './city-weather-card'
import { PackingSuggestions } from './packing-suggestions'
import { TempRangeBar } from './temp-range-bar'

interface WeatherSectionProps {
  endpoint: string
  initialData?: WeatherResponsePayload | null
  allowRefresh?: boolean
  shareMode?: boolean
  showPacking?: boolean
}

function LoadingState() {
  return (
    <div className="space-y-4 rounded-[28px] border border-[#d9e4f0] bg-[#f7fbff] p-5">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="flex gap-3 overflow-hidden">
        <Skeleton className="h-40 w-[250px] rounded-2xl" />
        <Skeleton className="h-40 w-[250px] rounded-2xl" />
        <Skeleton className="h-40 w-[250px] rounded-2xl" />
      </div>
    </div>
  )
}

export function WeatherSection({
  endpoint,
  initialData,
  allowRefresh = true,
  shareMode = false,
  showPacking = true,
}: WeatherSectionProps) {
  const [data, setData] = useState<WeatherResponsePayload | null | undefined>(initialData)
  const [loading, setLoading] = useState(!initialData)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialData !== undefined) return

    let cancelled = false
    setLoading(true)
    fetch(endpoint, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Failed to load weather.')
        return response.json() as Promise<WeatherResponsePayload>
      })
      .then((payload) => {
        if (!cancelled) setData(payload)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load weather.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [endpoint, initialData])

  async function refresh() {
    setRefreshing(true)
    setError(null)
    try {
      const response = await fetch(endpoint, { method: 'POST' })
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null
        throw new Error(payload?.error?.message ?? 'Failed to refresh weather.')
      }
      setData(await response.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh weather.')
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) return <LoadingState />
  if (error && !data) return <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
  if (!data || data.should_hide_section) return null

  const tempRange = data.temp_range
  const canShowPacking = showPacking && !shareMode
  const lockedPacking = canShowPacking && !data.can_view_packing
  const unit = tempRange?.unit ?? (data.unit === 'celsius' ? '°C' : '°F')

  return (
    <section className="space-y-4 rounded-[28px] border border-[#d9e4f0] bg-[#f7fbff] p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Weather-Aware Packing</h2>
          <p className="text-sm text-slate-500">
            Forecasts for the places that matter to this trip.
          </p>
        </div>
        {allowRefresh ? (
          <div className="flex items-center gap-3">
            {data.fetched_at ? (
              <span className="text-xs text-slate-500">Updated {formatDateTime(data.fetched_at)}</span>
            ) : null}
            <Button type="button" variant="outline" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        ) : null}
      </div>

      {data.empty_reason === 'no_locations' ? (
        <div className="rounded-2xl border border-dashed border-[#c9d9eb] bg-white/70 p-4 text-sm text-slate-600">
          Add flights or hotels to see weather for your destinations.
        </div>
      ) : null}

      {tempRange ? (
        <TempRangeBar
          min={tempRange.min}
          max={tempRange.max}
          unit={tempRange.unit}
          destinations={data.destinations}
        />
      ) : null}

      {data.destinations.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-2 xl:grid-cols-3">
          {data.destinations.map((destination) => (
            <CityWeatherCard key={destination.city} destination={destination} unit={unit} />
          ))}
        </div>
      ) : null}

      {canShowPacking ? <PackingSuggestions packing={data.packing} locked={lockedPacking} /> : null}
      {error ? <div className="text-sm text-amber-700">{error}</div> : null}
    </section>
  )
}
