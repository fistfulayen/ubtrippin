'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { formatDateRange } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MapPin, Calendar, Users, Pencil, Check, X, Camera } from 'lucide-react'
import { CoverImagePicker } from './cover-image-picker'
import type { Trip } from '@/types/database'

interface TripHeaderProps {
  trip: Trip
}

export function TripHeader({ trip }: TripHeaderProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(trip.title)
  const [loading, setLoading] = useState(false)
  const [showImagePicker, setShowImagePicker] = useState(false)

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
    <div className="relative overflow-hidden rounded-2xl">
      {/* Background image or gradient */}
      {trip.cover_image_url ? (
        <>
          <Image
            src={trip.cover_image_url}
            alt={trip.title}
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-black/30" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-r from-amber-100 to-orange-100" />
      )}

      {/* Change cover image button */}
      <button
        onClick={() => setShowImagePicker(true)}
        className={`absolute top-3 right-3 z-10 rounded-full p-2 transition-opacity opacity-60 hover:opacity-100 ${
          trip.cover_image_url
            ? 'bg-black/40 text-white hover:bg-black/60'
            : 'bg-white/60 text-gray-700 hover:bg-white/80'
        }`}
        title="Change cover image"
      >
        <Camera className="h-4 w-4" />
      </button>

      {/* Content */}
      <div className="relative p-6 sm:p-8">
        {/* Title */}
        <div className="flex items-start gap-3">
          {editing ? (
            <div className="flex flex-1 items-center gap-2">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-2xl font-bold bg-white text-gray-900"
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
              <h1
                className={`flex-1 text-2xl font-bold sm:text-3xl ${
                  trip.cover_image_url ? 'text-white' : 'text-gray-900'
                }`}
              >
                {trip.title}
              </h1>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(true)}
                className={
                  trip.cover_image_url
                    ? 'text-white/80 hover:text-white hover:bg-white/20'
                    : 'text-gray-600 hover:text-gray-900'
                }
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {/* Meta info */}
        <div
          className={`mt-4 flex flex-wrap gap-4 text-sm ${
            trip.cover_image_url ? 'text-white/90' : 'text-gray-700'
          }`}
        >
          {(trip.start_date || trip.end_date) && (
            <div className="flex items-center gap-1.5">
              <Calendar
                className={`h-4 w-4 ${trip.cover_image_url ? 'text-white' : 'text-amber-600'}`}
              />
              <span>{formatDateRange(trip.start_date, trip.end_date)}</span>
            </div>
          )}

          {trip.primary_location && (
            <div className="flex items-center gap-1.5">
              <MapPin
                className={`h-4 w-4 ${trip.cover_image_url ? 'text-white' : 'text-amber-600'}`}
              />
              <span>{trip.primary_location}</span>
            </div>
          )}

          {trip.travelers && trip.travelers.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Users
                className={`h-4 w-4 ${trip.cover_image_url ? 'text-white' : 'text-amber-600'}`}
              />
              <span>{trip.travelers.join(', ')}</span>
            </div>
          )}
        </div>

        {/* Notes */}
        {trip.notes && (
          <p
            className={`mt-4 text-sm rounded-lg p-3 ${
              trip.cover_image_url
                ? 'text-white/90 bg-black/20'
                : 'text-gray-600 bg-white/50'
            }`}
          >
            {trip.notes}
          </p>
        )}
      </div>

      {/* Cover image picker modal */}
      {showImagePicker && (
        <CoverImagePicker
          tripId={trip.id}
          currentImageUrl={trip.cover_image_url}
          onClose={() => setShowImagePicker(false)}
        />
      )}
    </div>
  )
}
