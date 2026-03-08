'use client'

import { Droplets, Wind } from 'lucide-react'
import { formatDateRange } from '@/lib/utils'
import { getWeatherIcon } from '@/lib/weather/weather-icons'
import type { WeatherDestination } from '@/lib/weather/types'

interface CityWeatherCardProps {
  destination: WeatherDestination
  unit: '°F' | '°C'
}

export function CityWeatherCard({ destination, unit }: CityWeatherCardProps) {
  const highs = destination.daily.map((day) => day.temp_high)
  const lows = destination.daily.map((day) => day.temp_low)
  const precip = destination.daily.reduce(
    (max, day) => Math.max(max, day.precipitation_probability),
    0
  )
  const wind = destination.daily.reduce((max, day) => Math.max(max, day.wind_speed_max_mph), 0)
  const firstDay = destination.daily[0]

  return (
    <div className="min-w-[250px] rounded-2xl border border-[#dbe7f3] bg-white/90 p-4 shadow-sm shadow-slate-200/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-slate-900">{destination.city}</div>
          <div className="text-sm text-slate-500">
            {formatDateRange(destination.dates.start, destination.dates.end)}
          </div>
        </div>
        <div className="text-3xl" aria-hidden="true">
          {getWeatherIcon(firstDay?.weather_code ?? 1)}
        </div>
      </div>

      <div className="mt-4 flex items-end gap-3">
        <div className="text-2xl font-semibold text-slate-900">
          {Math.round(Math.max(...highs))}
          {unit}
        </div>
        <div className="pb-0.5 text-sm text-slate-500">
          low {Math.round(Math.min(...lows))}
          {unit}
        </div>
      </div>

      <div className="mt-1 text-sm text-slate-600">{firstDay?.weather_description ?? 'Forecast ready'}</div>

      <div className="mt-4 flex items-center gap-4 text-sm text-slate-500">
        <div className="flex items-center gap-1">
          <Droplets className="h-4 w-4" />
          {Math.round(precip)}%
        </div>
        <div className="flex items-center gap-1">
          <Wind className="h-4 w-4" />
          {Math.round(wind)} mph
        </div>
      </div>
    </div>
  )
}
