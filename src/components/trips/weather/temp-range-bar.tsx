'use client'

import type { WeatherDestination } from '@/lib/weather/types'

interface TempRangeBarProps {
  min: number
  max: number
  unit: '°F' | '°C'
  destinations: WeatherDestination[]
}

function midpoint(destination: WeatherDestination) {
  const highs = destination.daily.map((day) => day.temp_high)
  const lows = destination.daily.map((day) => day.temp_low)
  return (Math.max(...highs) + Math.min(...lows)) / 2
}

export function TempRangeBar({ min, max, unit, destinations }: TempRangeBarProps) {
  const span = Math.max(1, max - min)

  return (
    <div className="rounded-2xl border border-[#dbe7f3] bg-white/80 p-4 shadow-sm shadow-slate-200/40">
      <div className="flex items-center justify-between text-sm font-medium text-slate-700">
        <span>Trip temperature swing</span>
        <span>
          {Math.round(min)}
          {unit} to {Math.round(max)}
          {unit}
        </span>
      </div>
      <div className="relative mt-4 h-4 overflow-hidden rounded-full bg-gradient-to-r from-sky-300 via-amber-200 to-rose-300">
        {destinations.map((destination) => {
          const value = midpoint(destination)
          const position = ((value - min) / span) * 100
          return (
            <div
              key={destination.city}
              className="absolute top-1/2 h-6 w-px -translate-y-1/2 bg-slate-900/60"
              style={{ left: `${position}%` }}
            />
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
        {destinations.map((destination) => (
          <span key={destination.city}>{destination.city}</span>
        ))}
      </div>
    </div>
  )
}
