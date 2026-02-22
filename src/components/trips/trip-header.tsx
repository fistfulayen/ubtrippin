'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { formatDateRange } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  MapPin,
  Calendar,
  Users,
  Pencil,
  Check,
  X,
  Camera,
  Share2,
  Copy,
  CheckCheck,
  Link as LinkIcon,
} from 'lucide-react'
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

  // Share dialog state
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [shareEnabled, setShareEnabled] = useState(trip.share_enabled ?? false)
  const [shareUrl, setShareUrl] = useState<string | null>(
    trip.share_token && trip.share_enabled
      ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.ubtrippin.xyz'}/share/${trip.share_token}`
      : null
  )
  const [shareLoading, setShareLoading] = useState(false)
  const [copied, setCopied] = useState(false)

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

  const handleToggleShare = useCallback(async () => {
    setShareLoading(true)
    try {
      if (!shareEnabled) {
        // Enable sharing
        const res = await fetch(`/api/trips/${trip.id}/share`, { method: 'POST' })
        if (res.ok) {
          const data = await res.json() as { share_url: string; share_token: string }
          setShareUrl(data.share_url)
          setShareEnabled(true)
        }
      } else {
        // Disable sharing
        const res = await fetch(`/api/trips/${trip.id}/share`, { method: 'DELETE' })
        if (res.ok) {
          setShareEnabled(false)
          // Keep shareUrl so the URL field stays visible (just disabled)
        }
      }
    } finally {
      setShareLoading(false)
    }
  }, [shareEnabled, trip.id])

  const handleOpenShareDialog = useCallback(async () => {
    // Refresh share status from server when opening
    setShowShareDialog(true)
    const res = await fetch(`/api/trips/${trip.id}/share`)
    if (res.ok) {
      const data = await res.json() as {
        share_enabled: boolean
        share_url: string | null
        share_token: string | null
      }
      setShareEnabled(data.share_enabled)
      setShareUrl(data.share_url)
    }
  }, [trip.id])

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [shareUrl])

  const handleDownloadCalendar = useCallback(() => {
    window.location.href = `/api/trips/${trip.id}/calendar`
  }, [trip.id])

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

      {/* Buttons: share, cover, edit */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
        {/* Calendar download button */}
        <button
          onClick={handleDownloadCalendar}
          className={`rounded-full p-2 transition-opacity opacity-60 hover:opacity-100 ${
            trip.cover_image_url
              ? 'bg-black/40 text-white hover:bg-black/60'
              : 'bg-white/60 text-gray-700 hover:bg-white/80'
          }`}
          title="Add to Calendar"
        >
          <Calendar className="h-4 w-4" />
        </button>

        {/* Share button */}
        <button
          onClick={handleOpenShareDialog}
          className={`rounded-full p-2 transition-opacity opacity-60 hover:opacity-100 ${
            trip.cover_image_url
              ? 'bg-black/40 text-white hover:bg-black/60'
              : 'bg-white/60 text-gray-700 hover:bg-white/80'
          }`}
          title="Share trip"
        >
          <Share2 className="h-4 w-4" />
        </button>

        {/* Change cover image button */}
        <button
          onClick={() => setShowImagePicker(true)}
          className={`rounded-full p-2 transition-opacity opacity-60 hover:opacity-100 ${
            trip.cover_image_url
              ? 'bg-black/40 text-white hover:bg-black/60'
              : 'bg-white/60 text-gray-700 hover:bg-white/80'
          }`}
          title="Change cover image"
        >
          <Camera className="h-4 w-4" />
        </button>
      </div>

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

      {/* Share dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-amber-600" />
              Share trip
            </DialogTitle>
            <DialogDescription>
              Create a view-only link anyone can use to see this trip.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {/* Toggle */}
            <div className="flex items-center justify-between rounded-xl border border-gray-200 p-4">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {shareEnabled ? 'Sharing enabled' : 'Sharing disabled'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {shareEnabled
                    ? 'Anyone with the link can view this trip'
                    : 'Only you can see this trip'}
                </p>
              </div>
              <button
                role="switch"
                aria-checked={shareEnabled}
                onClick={handleToggleShare}
                disabled={shareLoading}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                  shareEnabled ? 'bg-amber-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                    shareEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Share URL */}
            {shareEnabled && shareUrl && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="flex flex-1 items-center rounded-lg border border-gray-200 bg-gray-50 px-3 gap-2 min-w-0">
                    <LinkIcon className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="truncate text-sm text-gray-600 py-2">{shareUrl}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopy}
                    className="shrink-0"
                  >
                    {copied ? (
                      <>
                        <CheckCheck className="h-4 w-4 text-green-600 mr-1.5" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1.5" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-gray-400 flex items-start gap-1.5">
                  <span>🔒</span>
                  Anyone with this link can view this trip. Confirmation codes are hidden.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
