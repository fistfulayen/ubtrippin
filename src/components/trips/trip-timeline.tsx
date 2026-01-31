'use client'

import { groupByDate, formatDate } from '@/lib/utils'
import { TripItemCard } from './trip-item-card'
import { Plus, Calendar } from 'lucide-react'
import Link from 'next/link'
import type { TripItem, Trip } from '@/types/database'

interface TripTimelineProps {
  items: TripItem[]
  tripId: string
  allTrips: Pick<Trip, 'id' | 'title' | 'start_date'>[]
}

export function TripTimeline({ items, tripId, allTrips }: TripTimelineProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
        <Calendar className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-4 font-semibold text-gray-900">No items yet</h3>
        <p className="mt-1 text-sm text-gray-600">
          Add reservations, flights, and activities to build your itinerary.
        </p>
        <Link
          href={`/trips/${tripId}/add-item`}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
        >
          <Plus className="h-4 w-4" />
          Add first item
        </Link>
      </div>
    )
  }

  // Group items by date
  const groupedItems = groupByDate(items)
  const sortedDates = Array.from(groupedItems.keys()).sort()

  return (
    <div className="space-y-6">
      {sortedDates.map((date, dateIndex) => {
        const dayItems = groupedItems.get(date) || []

        // Sort items by start_ts within the day
        const sortedDayItems = [...dayItems].sort((a, b) => {
          if (!a.start_ts && !b.start_ts) return 0
          if (!a.start_ts) return 1
          if (!b.start_ts) return -1
          return new Date(a.start_ts).getTime() - new Date(b.start_ts).getTime()
        })

        return (
          <div key={date} className="relative">
            {/* Date header */}
            <div className="sticky top-20 z-10 mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 font-semibold">
                {dateIndex + 1}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{formatDate(date)}</h3>
                <p className="text-sm text-gray-500">
                  {sortedDayItems.length} {sortedDayItems.length === 1 ? 'item' : 'items'}
                </p>
              </div>
            </div>

            {/* Items for this day */}
            <div className="ml-5 border-l-2 border-amber-200 pl-8 space-y-4">
              {sortedDayItems.map((item) => (
                <TripItemCard key={item.id} item={item} allTrips={allTrips} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
