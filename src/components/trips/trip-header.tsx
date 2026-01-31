'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDateRange } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MapPin, Calendar, Users, Pencil, Check, X } from 'lucide-react'
import type { Trip } from '@/types/database'

interface TripHeaderProps {
  trip: Trip
}

export function TripHeader({ trip }: TripHeaderProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(trip.title)
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    if (!title.trim()) return

    setLoading(true)
    const supabase = createClient()

    await supabase.from('trips').update({ title: title.trim() }).eq('id', trip.id)

    setLoading(false)
    setEditing(false)
    router.refresh()
  }

  const handleCancel = () => {
    setTitle(trip.title)
    setEditing(false)
  }

  return (
    <div className="rounded-2xl bg-gradient-to-r from-amber-100 to-orange-100 p-6 sm:p-8">
      {/* Title */}
      <div className="flex items-start gap-3">
        {editing ? (
          <div className="flex flex-1 items-center gap-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-2xl font-bold bg-white"
              autoFocus
            />
            <Button size="sm" onClick={handleSave} disabled={loading}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <h1 className="flex-1 text-2xl font-bold text-gray-900 sm:text-3xl">
              {trip.title}
            </h1>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditing(true)}
              className="text-gray-600 hover:text-gray-900"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* Meta info */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-700">
        {(trip.start_date || trip.end_date) && (
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-amber-600" />
            <span>{formatDateRange(trip.start_date, trip.end_date)}</span>
          </div>
        )}

        {trip.primary_location && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-amber-600" />
            <span>{trip.primary_location}</span>
          </div>
        )}

        {trip.travelers && trip.travelers.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-amber-600" />
            <span>{trip.travelers.join(', ')}</span>
          </div>
        )}
      </div>

      {/* Notes */}
      {trip.notes && (
        <p className="mt-4 text-gray-600 text-sm bg-white/50 rounded-lg p-3">
          {trip.notes}
        </p>
      )}
    </div>
  )
}
