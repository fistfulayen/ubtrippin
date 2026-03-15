'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn, formatDateRange } from '@/lib/utils'
import { CalendarDays, CheckCircle2, Loader2, Upload, XCircle } from 'lucide-react'

interface PreviewItem {
  provider_item_id: string
  kind: string
  summary: string | null
  start_date: string
  end_date: string | null
  start_location: string | null
  end_location: string | null
  confidence: number
  is_duplicate: boolean
}

interface PreviewTrip {
  name: string
  start_date: string
  end_date: string | null
  primary_location: string | null
  items: PreviewItem[]
}

interface PreviewResponse {
  trips: PreviewTrip[]
  item_count: number
  deduped_item_count: number
}

interface ConfirmResponse extends PreviewResponse {
  created: {
    trips: number
    items: number
  }
  skipped_duplicates: number
}

function kindLabel(kind: string): string {
  switch (kind) {
    case 'car':
      return 'Car rental'
    case 'ticket':
      return 'Event'
    default:
      return kind.charAt(0).toUpperCase() + kind.slice(1)
  }
}

function confidenceVariant(confidence: number): 'success' | 'warning' | 'outline' {
  if (confidence >= 0.8) return 'success'
  if (confidence >= 0.65) return 'warning'
  return 'outline'
}

export function IcsImportSection() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [success, setSuccess] = useState<ConfirmResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [loading, setLoading] = useState<'preview' | 'confirm' | null>(null)

  const totalFreshItems = useMemo(() => {
    if (!preview) return 0
    return preview.item_count - preview.deduped_item_count
  }, [preview])

  async function submit(confirm: boolean) {
    if (!file) {
      setError('Choose an .ics file first.')
      return
    }

    setError(null)
    setSuccess(null)
    setLoading(confirm ? 'confirm' : 'preview')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/v1/import/ics${confirm ? '?confirm=true' : ''}`, {
        method: 'POST',
        body: formData,
      })

      const payload = (await response.json()) as PreviewResponse | ConfirmResponse | { error?: { message?: string } }
      if (!response.ok) {
        const nextError = 'error' in payload ? payload.error?.message : undefined
        setError(nextError || 'Import failed.')
        return
      }

      if (confirm) {
        setSuccess(payload as ConfirmResponse)
        setPreview(null)
      } else {
        setPreview(payload as PreviewResponse)
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Import failed.')
    } finally {
      setLoading(null)
    }
  }

  function chooseFile(nextFile: File | null) {
    setFile(nextFile)
    setPreview(null)
    setSuccess(null)
    setError(null)
  }

  return (
    <div className="space-y-5">
      <div
        className={cn(
          'rounded-2xl border border-dashed p-6 transition-colors',
          dragActive ? 'border-[#4f46e5] bg-[#eef2ff]' : 'border-[#cbd5e1] bg-[#f8fafc]'
        )}
        onDragOver={(event) => {
          event.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          setDragActive(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragActive(false)
          chooseFile(event.dataTransfer.files?.[0] || null)
        }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[#1e293b]">
              <Upload className="h-5 w-5 text-[#4f46e5]" />
              <p className="font-medium">Upload an ICS calendar export</p>
            </div>
            <p className="text-sm text-gray-600">
              Import events from TripIt, Google Calendar, Outlook, or any `.ics` export.
            </p>
            {file ? (
              <p className="text-sm text-[#1e293b]">
                Selected: <strong>{file.name}</strong> ({Math.ceil(file.size / 1024)} KB)
              </p>
            ) : (
              <p className="text-sm text-gray-500">Drag a file here or use the picker.</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              type="file"
              accept=".ics,text/calendar"
              className="hidden"
              onChange={(event) => chooseFile(event.target.files?.[0] || null)}
            />
            <Button variant="outline" onClick={() => inputRef.current?.click()}>
              Choose File
            </Button>
            <Button onClick={() => void submit(false)} disabled={!file || loading !== null}>
              {loading === 'preview' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Preview Import
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      {success ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-700" />
            <div className="space-y-1 text-sm text-green-900">
              <p className="font-medium">Import complete.</p>
              <p>
                Created {success.created.trips} trip{success.created.trips === 1 ? '' : 's'} and{' '}
                {success.created.items} item{success.created.items === 1 ? '' : 's'}.
                {success.skipped_duplicates > 0
                  ? ` Skipped ${success.skipped_duplicates} duplicate event${success.skipped_duplicates === 1 ? '' : 's'}.`
                  : ''}
              </p>
              <p>
                Review your imported itinerary on the{' '}
                <Link href="/trips" className="underline">
                  trips page
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {preview ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 rounded-xl border border-[#cbd5e1] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-[#1e293b]">
              <p className="font-medium">
                {preview.trips.length} trip{preview.trips.length === 1 ? '' : 's'} previewed
              </p>
              <p className="text-gray-600">
                {totalFreshItems} new item{totalFreshItems === 1 ? '' : 's'} ready to import.
                {preview.deduped_item_count > 0
                  ? ` ${preview.deduped_item_count} already imported event${preview.deduped_item_count === 1 ? '' : 's'} will be skipped.`
                  : ''}
              </p>
            </div>
            <Button onClick={() => void submit(true)} disabled={loading !== null || totalFreshItems === 0}>
              {loading === 'confirm' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm Import
            </Button>
          </div>

          {preview.trips.map((trip) => (
            <div key={`${trip.name}-${trip.start_date}`} className="rounded-2xl border border-[#cbd5e1] bg-white p-5">
              <div className="flex flex-col gap-3 border-b border-[#e2e8f0] pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-lg font-semibold text-[#1e293b]">{trip.name}</p>
                  <p className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                    <CalendarDays className="h-4 w-4" />
                    {formatDateRange(trip.start_date, trip.end_date)}
                  </p>
                </div>
                {trip.primary_location ? (
                  <Badge variant="outline">{trip.primary_location}</Badge>
                ) : null}
              </div>

              <div className="mt-4 space-y-3">
                {trip.items.map((item) => (
                  <div
                    key={item.provider_item_id}
                    className={cn(
                      'rounded-xl border p-3',
                      item.is_duplicate ? 'border-amber-200 bg-amber-50' : 'border-[#e2e8f0] bg-[#f8fafc]'
                    )}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-[#1e293b]">
                            {item.summary || 'Untitled calendar event'}
                          </p>
                          <Badge variant="secondary">{kindLabel(item.kind)}</Badge>
                          <Badge variant={confidenceVariant(item.confidence)}>
                            {Math.round(item.confidence * 100)}%
                          </Badge>
                          {item.is_duplicate ? <Badge variant="warning">Already imported</Badge> : null}
                        </div>
                        <p className="text-sm text-gray-600">
                          {formatDateRange(item.start_date, item.end_date)}
                        </p>
                        {item.start_location || item.end_location ? (
                          <p className="text-sm text-gray-600">
                            {[item.start_location, item.end_location].filter(Boolean).join(' -> ')}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
