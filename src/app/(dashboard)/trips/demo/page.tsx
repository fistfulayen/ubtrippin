import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { DEMO_TRIP, DEMO_ITEMS } from '@/app/api/v1/trips/demo/route'
import { DemoBanner } from './demo-banner'

const KIND_LABELS: Record<string, string> = {
  flight: '✈️ Flight',
  hotel: '🏨 Hotel',
  train: '🚆 Train',
  restaurant: '🍽️ Restaurant',
  activity: '🎯 Activity',
  rental_car: '🚗 Rental Car',
  ferry: '⛴️ Ferry',
  bus: '🚌 Bus',
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function DemoTripPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Back link */}
      <Link
        href="/trips"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to my trips
      </Link>

      {/* Demo banner with copy button (client component) */}
      <DemoBanner />

      {/* Trip header */}
      <div className="rounded-2xl border border-[#cbd5e1] bg-white p-6">
        <h1 className="text-2xl font-bold text-[#1e293b]">{DEMO_TRIP.title}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {formatDate(DEMO_TRIP.start_date)} – {formatDate(DEMO_TRIP.end_date)}
          {DEMO_TRIP.primary_location && (
            <> &middot; {DEMO_TRIP.primary_location}</>
          )}
        </p>
      </div>

      {/* Items list */}
      <div className="rounded-2xl border border-[#cbd5e1] bg-white divide-y divide-[#f1f5f9]">
        {DEMO_ITEMS.map((item) => (
          <div key={item.id} className="p-4 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#4f46e5]">
                {KIND_LABELS[item.kind] ?? item.kind}
              </span>
              {item.confirmation_code && (
                <span className="text-xs text-gray-400 font-mono">
                  #{item.confirmation_code}
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-[#1e293b]">{item.summary}</p>
            <p className="text-xs text-gray-400">
              {formatDate(item.start_date)}
              {item.start_location && ` · ${item.start_location}`}
              {item.end_location && ` → ${item.end_location}`}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
