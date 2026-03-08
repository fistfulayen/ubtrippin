'use client'

import type { CitySegment } from '@/lib/trips/city-segments'
import { getWeatherEmoji } from '@/lib/weather/item-weather'

interface CitySegmentHeaderProps {
  segment: CitySegment
}

function countryCodeToFlag(code: string): string {
  if (!code || code.length !== 2) return ''
  return code.toUpperCase().replace(/./g, (char) =>
    String.fromCodePoint(char.charCodeAt(0) + 127397)
  )
}

function formatSegmentRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  const sameDay = startDate === endDate
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
  const sameYear = start.getFullYear() === end.getFullYear()

  const startOpts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const endOpts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }

  // Include year when crossing year boundaries
  if (!sameYear) {
    startOpts.year = 'numeric'
    endOpts.year = 'numeric'
  }

  if (sameDay) {
    return start.toLocaleDateString('en-US', startOpts)
  }

  if (sameMonth) {
    return `${start.toLocaleDateString('en-US', startOpts)}-${end.getDate()}`
  }

  return `${start.toLocaleDateString('en-US', startOpts)} – ${end.toLocaleDateString('en-US', endOpts)}`
}

function durationLabel(segment: CitySegment) {
  if (segment.durationNights === 1) return '1 night'
  if (segment.durationNights > 1) return `${segment.durationNights} nights`
  return 'Same day'
}

export function CitySegmentHeader({ segment }: CitySegmentHeaderProps) {
  return (
    <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#eef4ff_100%)] px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold text-slate-900">{segment.city}</h3>
            {segment.countryCode ? (
              <span className="text-lg" aria-label={segment.countryCode}>
                {countryCodeToFlag(segment.countryCode)}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {durationLabel(segment)} · {formatSegmentRange(segment.startDate, segment.endDate)}
          </p>
        </div>

        {segment.weatherForecast && segment.weatherForecast.length > 0 ? (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:max-w-[28rem]">
            {segment.weatherForecast.map((day) => (
              <div
                key={day.date}
                className="min-w-[72px] rounded-2xl border border-sky-100 bg-white/90 px-3 py-2 text-center shadow-sm shadow-slate-200/40"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {new Date(`${day.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <div className="mt-1 text-lg">{getWeatherEmoji(day.weather_code)}</div>
                <div className="mt-1 text-xs font-medium text-slate-700">
                  {Math.round(day.temp_high)}{segment.weatherUnit} / {Math.round(day.temp_low)}{segment.weatherUnit}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
