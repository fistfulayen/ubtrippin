import { cache } from 'react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
  MapPin,
  Calendar,
  Users,
  Plane,
  Building2,
  TrainFront,
  Car,
  Utensils,
  Ticket,
  CalendarDays,
} from 'lucide-react'
import { createSecretClient } from '@/lib/supabase/service'
import { formatDateRange, getKindIcon } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { getProviderLogoUrl } from '@/lib/images/provider-logo'
import { extractAirlineCode } from '@/lib/images/airline-logo'
import type { TripItemKind } from '@/types/database'
import { AirlineLogoIcon } from './airline-logo-icon'
import { ShareTripButton } from './share-trip-button'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ubtrippin.xyz'
const DEFAULT_OG_IMAGE_URL = `${APP_URL}/x-header.png`

interface SharePageProps {
  params: Promise<{ token: string }>
}

interface ShareTrip {
  id: string
  title: string
  start_date: string
  end_date: string | null
  primary_location: string | null
  travelers: string[] | null
  notes: string | null
  cover_image_url: string | null
  share_enabled: boolean | null
}

interface ShareTripItem {
  id: string
  kind: TripItemKind
  provider: string | null
  traveler_names: string[]
  start_date: string
  end_date: string | null
  start_location: string | null
  end_location: string | null
  summary: string | null
  details_json: Record<string, unknown> | null
}

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const MINUTE_MS = 60 * 1000

/** Return first name + last initial only (e.g. "John Smith" -> "John S.") */
function obfuscateName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}

/** Capitalise first letter of a string */
function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function KindIcon({ kind, className }: { kind: TripItemKind; className?: string }) {
  const icon = getKindIcon(kind)
  const props = { className: className ?? 'h-4 w-4' }
  switch (icon) {
    case 'plane':
      return <Plane {...props} />
    case 'building':
      return <Building2 {...props} />
    case 'train-front':
      return <TrainFront {...props} />
    case 'car':
      return <Car {...props} />
    case 'utensils':
      return <Utensils {...props} />
    case 'ticket':
      return <Ticket {...props} />
    default:
      return <CalendarDays {...props} />
  }
}

const kindColors: Record<TripItemKind, string> = {
  flight: 'bg-sky-100 text-sky-800',
  hotel: 'bg-[#f1f5f9] text-[#1e293b]',
  train: 'bg-emerald-100 text-emerald-800',
  car: 'bg-[#f1f5f9] text-[#4f46e5]',
  restaurant: 'bg-rose-100 text-rose-800',
  activity: 'bg-purple-100 text-purple-800',
  ticket: 'bg-amber-100 text-amber-800',
  other: 'bg-gray-100 text-gray-800',
}

const isValidShareToken = (token: string) => /^[A-Za-z0-9_-]{10,64}$/.test(token)

const getSharedTripData = cache(async (token: string): Promise<{ trip: ShareTrip | null; items: ShareTripItem[] | null }> => {
  if (!isValidShareToken(token)) {
    return { trip: null, items: null }
  }

  const supabase = createSecretClient()

  // SECURITY: Select only fields needed for display — exclude sensitive fields (confirmation_code, etc.)
  // Note: service-role client is required here since visitors are unauthenticated.
  // RLS is intentionally bypassed; share_enabled check acts as the gate.
  const { data: tripRow } = await supabase
    .from('trips')
    .select('id, title, start_date, end_date, primary_location, travelers, notes, cover_image_url, share_enabled')
    .eq('share_token', token)
    .eq('share_enabled', true)
    .single()

  const trip = tripRow as ShareTrip | null
  if (!trip) {
    return { trip: null, items: null }
  }

  // SECURITY: Fetch fields needed for display — explicitly exclude confirmation_code and
  // source_email_id. details_json is included but sanitised below before rendering.
  const { data: rawItems } = await supabase
    .from('trip_items')
    .select('id, trip_id, kind, provider, summary, start_date, end_date, start_ts, end_ts, start_location, end_location, traveler_names, needs_review, status, details_json')
    .eq('trip_id', trip.id)
    .order('start_date', { ascending: true })
    .order('start_ts', { ascending: true })

  // Strip sensitive fields from details_json before passing to the component
  const items = rawItems?.map((item): ShareTripItem => {
    const { details_json, ...rest } = item
    let safeDetails: Record<string, unknown> | null = null
    if (details_json && typeof details_json === 'object') {
      const { confirmation_code, booking_reference, ...remaining } = details_json as Record<string, unknown>
      void confirmation_code
      void booking_reference
      safeDetails = remaining
    }
    return { ...rest, details_json: safeDetails }
  }) ?? null

  return { trip, items }
})

function normaliseCityLabel(location: string) {
  // Strip anything that isn't alphanumeric, space, hyphen, period, or common diacritics
  const city = location.split(',')[0].trim()
  return city.replace(/[^\p{L}\p{N}\s.\-']/gu, '').slice(0, 100)
}

function buildTripSummaryDescription(trip: ShareTrip, items: ShareTripItem[] | null) {
  const dateLabel = formatDateRange(trip.start_date, trip.end_date)
  const itemCount = items?.length ?? 0

  const cities = new Set<string>()
  if (trip.primary_location) cities.add(normaliseCityLabel(trip.primary_location))
  items?.forEach((item) => {
    if (item.start_location) cities.add(normaliseCityLabel(item.start_location))
    if (item.end_location) cities.add(normaliseCityLabel(item.end_location))
  })

  const cityList = [...cities].filter(Boolean).slice(0, 3).join(' • ')
  const itemLabel = `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`
  return [dateLabel, itemLabel, cityList].filter(Boolean).join(' · ')
}

function formatTimelineDate(date: string | null) {
  if (!date) return 'Date TBD'
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return 'Date TBD'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed)
}

function readNumber(details: Record<string, unknown> | null, key: string) {
  const value = details?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readString(details: Record<string, unknown> | null, key: string) {
  const value = details?.[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function formatHoursAndMinutes(totalMinutes: number) {
  const roundedMinutes = Math.max(1, Math.round(totalMinutes))
  const hours = Math.floor(roundedMinutes / 60)
  const minutes = roundedMinutes % 60
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h`
  return `${minutes}m`
}

function parseDateWithOptionalTime(date: string | null, hhmm: string | undefined, endOfDay = false) {
  if (!date) return null
  // Validate date format to prevent unexpected Date parsing behavior
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const normalizedTime = hhmm && /^\d{1,2}:\d{2}$/.test(hhmm)
    ? `${hhmm.padStart(5, '0')}:00`
    : (endOfDay ? '23:59:00' : '00:00:00')
  const parsed = new Date(`${date}T${normalizedTime}`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getItemStartDate(item: ShareTripItem) {
  const details = item.details_json as Record<string, unknown> | null
  const departureTime = readString(details, 'departure_local_time') ?? undefined
  return parseDateWithOptionalTime(item.start_date, departureTime, false)
}

function getItemEndDate(item: ShareTripItem) {
  const details = item.details_json as Record<string, unknown> | null
  const arrivalTime = readString(details, 'arrival_local_time') ?? undefined
  return parseDateWithOptionalTime(item.end_date ?? item.start_date, arrivalTime, true)
}

/**
 * Extract a city name from a location string.
 * Hotel locations are often full names like "The Stephen F Austin Royal Sonesta Hotel"
 * with no comma-separated city. We only return a city if the location looks like
 * "City, State" or "Place, City, Country" — i.e., has a comma.
 */
function extractCity(location: string | null): string | null {
  if (!location) return null
  // Only treat as a city if there's a comma (e.g. "Austin, TX" or "Miami, FL")
  // Full hotel/venue names without commas are not useful city labels
  if (!location.includes(',')) return null
  return normaliseCityLabel(location)
}

function formatGapLabel(previous: ShareTripItem, next: ShareTripItem) {
  const previousEnd = getItemEndDate(previous)
  const nextStart = getItemStartDate(next)
  if (!previousEnd || !nextStart) return null

  const diffMs = nextStart.getTime() - previousEnd.getTime()
  if (diffMs <= 0) return null

  if (diffMs < DAY_MS) {
    const totalMinutes = diffMs / MINUTE_MS
    return `${formatHoursAndMinutes(totalMinutes)} layover`
  }

  // Use ceiling for day count — a gap from Tue afternoon to Thu morning is 2 days, not 1
  const days = Math.max(1, Math.ceil(diffMs / DAY_MS))
  // Prefer the city where you ARE (previous end), not where you're going
  const city = extractCity(previous.end_location) ?? extractCity(next.start_location)
  if (!city) return `${days} ${days === 1 ? 'day' : 'days'}`
  return `${days} ${days === 1 ? 'day' : 'days'} in ${city}`
}

function getFlightDurationLabel(item: ShareTripItem) {
  const details = item.details_json as Record<string, unknown> | null
  const textDuration = readString(details, 'flight_duration')
    ?? readString(details, 'duration')
    ?? readString(details, 'flight_time')
  if (textDuration) return textDuration

  const minutes = readNumber(details, 'flight_duration_minutes')
    ?? readNumber(details, 'duration_minutes')
    ?? readNumber(details, 'flight_time_minutes')
  if (minutes && minutes > 0) return formatHoursAndMinutes(minutes)

  const start = getItemStartDate(item)
  const end = getItemEndDate(item)
  if (start && end) {
    const diffMinutes = (end.getTime() - start.getTime()) / MINUTE_MS
    if (diffMinutes > 0 && diffMinutes < 48 * 60) {
      return formatHoursAndMinutes(diffMinutes)
    }
  }
  return null
}

function getHotelDurationLabel(item: ShareTripItem) {
  const details = item.details_json as Record<string, unknown> | null
  const nightsFromDetails = readNumber(details, 'nights')
  if (nightsFromDetails && nightsFromDetails > 0) {
    return `${nightsFromDetails} ${nightsFromDetails === 1 ? 'night' : 'nights'}`
  }
  if (item.end_date) {
    const start = parseDateWithOptionalTime(item.start_date, undefined, false)
    const end = parseDateWithOptionalTime(item.end_date, undefined, false)
    if (start && end) {
      const nights = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS))
      return `${nights} ${nights === 1 ? 'night' : 'nights'}`
    }
  }
  return null
}

function getItemDurationLabel(item: ShareTripItem) {
  switch (item.kind) {
    case 'flight': return getFlightDurationLabel(item)
    case 'hotel': return getHotelDurationLabel(item)
    default: return null
  }
}

function TripItemRow({ item, durationLabel }: { item: ShareTripItem; durationLabel?: string | null }) {
  const names = item.traveler_names.map(obfuscateName)
  const location =
    item.start_location && item.end_location
      ? `${item.start_location} → ${item.end_location}`
      : item.start_location || item.end_location || null
  const details = item.details_json as Record<string, unknown> | null
  const flightNumber = details?.flight_number as string | undefined
  const iataCode = flightNumber ? extractAirlineCode(flightNumber) : null
  const airlineLogoUrl = item.kind === 'flight'
    ? (iataCode ? `https://pics.avs.io/80/80/${iataCode}@2x.png` : (item.provider ? getProviderLogoUrl(item.provider, item.kind) : null))
    : null
  const departureTime = details?.departure_local_time as string | undefined
  const arrivalTime = details?.arrival_local_time as string | undefined
  const displayTitle = flightNumber
    ? `${item.provider ?? capitalise(item.kind)} ${flightNumber}`
    : item.provider ?? capitalise(item.kind)

  const timeDisplay = departureTime && arrivalTime
    ? `${departureTime} → ${arrivalTime}`
    : departureTime
      ? `Departs ${departureTime}`
      : arrivalTime
        ? `Arrives ${arrivalTime}`
        : null

  return (
    <div className="flex items-start gap-3 py-4">
      {airlineLogoUrl ? (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white">
          <AirlineLogoIcon url={airlineLogoUrl} alt={item.provider || 'Airline'} />
        </div>
      ) : (
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${kindColors[item.kind]}`}
        >
          <KindIcon kind={item.kind} className="h-4 w-4" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-gray-900">
            {displayTitle}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${kindColors[item.kind]}`}
          >
            {capitalise(item.kind)}
          </span>
          {durationLabel && (
            <span className="inline-flex items-center rounded-full border border-[#cbd5e1] bg-[#eef2ff] px-2 py-0.5 text-xs font-medium text-[#4338ca]">
              {durationLabel}
            </span>
          )}
        </div>

        {timeDisplay && (
          <p className="mt-1 text-sm font-medium text-gray-800">{timeDisplay}</p>
        )}

        {item.summary && !timeDisplay && (
          <p className="mt-0.5 text-sm leading-snug text-gray-600">{item.summary}</p>
        )}

        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
          {(item.start_date || item.end_date) && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-[#4f46e5]" />
              {formatDateRange(item.start_date, item.end_date)}
            </span>
          )}
          {location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3 text-[#4f46e5]" />
              {location}
            </span>
          )}
          {names.length > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3 text-[#4f46e5]" />
              {names.join(', ')}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { token } = await params
  const { trip, items } = await getSharedTripData(token)

  if (!trip) {
    return {
      title: 'Shared Trip | UBTRIPPIN',
      description: 'A shared UBTRIPPIN itinerary.',
    }
  }

  const shareUrl = `${APP_URL}/share/${token}`
  const ogImage = trip.cover_image_url || DEFAULT_OG_IMAGE_URL
  const description = buildTripSummaryDescription(trip, items)

  return {
    title: trip.title,
    description,
    openGraph: {
      title: trip.title,
      description,
      url: shareUrl,
      type: 'website',
      images: [{ url: ogImage }],
    },
    twitter: {
      card: 'summary_large_image',
      title: trip.title,
      description,
      images: [ogImage],
    },
  }
}

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params
  const { trip, items } = await getSharedTripData(token)

  if (!isValidShareToken(token)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#ffffff] p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Trip not found</h1>
          <p className="mt-2 text-gray-500">This trip either doesn&apos;t exist or sharing has been disabled.</p>
        </div>
      </div>
    )
  }

  if (!trip) {
    return (
      <div className="flex min-h-screen flex-col bg-[#ffffff]">
        <header className="border-b border-[#cbd5e1] bg-white/80 backdrop-blur-sm">
          <div className="mx-auto max-w-4xl px-4 py-4">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/ubtrippin_logo.png" alt="UBTRIPPIN" width={32} height={32} className="rounded-lg" />
              <span className="text-lg font-bold text-[#4338ca]">UBTRIPPIN</span>
            </Link>
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center p-8">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#f1f5f9]">
              <MapPin className="h-8 w-8 text-[#4f46e5]" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Trip not found</h1>
            <p className="mt-2 text-gray-500">
              This trip either doesn&apos;t exist or sharing has been disabled.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center rounded-lg bg-[#1e293b] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#312e81]"
            >
              Plan your own trip with UBTRIPPIN
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const travelers = (trip.travelers ?? []).map(obfuscateName)
  const itemCount = items?.length ?? 0

  return (
    <div className="flex min-h-screen flex-col bg-[#ffffff]">
      <header className="sticky top-0 z-20 border-b border-[#cbd5e1] bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/ubtrippin_logo.png" alt="UBTRIPPIN" width={28} height={28} className="rounded-lg" />
            <span className="text-base font-bold text-[#4338ca]">UBTRIPPIN</span>
          </Link>
          <div className="flex items-center gap-2">
            <ShareTripButton shareUrl={`${APP_URL}/share/${token}`} />
            <Link
              href="/"
              className="rounded-lg bg-[#1e293b] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#312e81]"
            >
              Plan your trip free
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="relative overflow-hidden">
          {trip.cover_image_url ? (
            <>
              <div className="relative h-64 w-full sm:h-80">
                <Image
                  src={trip.cover_image_url}
                  alt={trip.title}
                  fill
                  className="object-cover"
                  priority
                  sizes="100vw"
                  unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                <div className="mx-auto max-w-4xl">
                  <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl">
                    {trip.title}
                  </h1>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-white/90">
                    {(trip.start_date || trip.end_date) && (
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        {formatDateRange(trip.start_date, trip.end_date)}
                      </span>
                    )}
                    {trip.primary_location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4" />
                        {trip.primary_location}
                      </span>
                    )}
                    {travelers.length > 0 && (
                      <span className="flex items-center gap-1.5">
                        <Users className="h-4 w-4" />
                        {travelers.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-gradient-to-r from-[#f1f5f9] to-[#ffffff] px-6 py-10 sm:px-8">
              <div className="mx-auto max-w-4xl">
                <h1 className="text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">
                  {trip.title}
                </h1>
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-700">
                  {(trip.start_date || trip.end_date) && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-[#4f46e5]" />
                      {formatDateRange(trip.start_date, trip.end_date)}
                    </span>
                  )}
                  {trip.primary_location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-[#4f46e5]" />
                      {trip.primary_location}
                    </span>
                  )}
                  {travelers.length > 0 && (
                    <span className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-[#4f46e5]" />
                      {travelers.join(', ')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          {itemCount > 0 && (
            <div className="mb-6 flex flex-wrap gap-3">
              <Badge variant="secondary" className="text-xs">
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </Badge>
              {trip.primary_location && (
                <Badge variant="default" className="text-xs">
                  <MapPin className="mr-1 h-3 w-3" />
                  {trip.primary_location}
                </Badge>
              )}
            </div>
          )}

          {trip.notes && (
            <Card className="mb-6 border-[#cbd5e1] bg-[#ffffff]">
              <CardContent className="p-4">
                <p className="text-sm leading-relaxed text-gray-700">{trip.notes}</p>
              </CardContent>
            </Card>
          )}

          {items && items.length > 0 ? (
            <Card className="border-[#cbd5e1]">
              <CardContent className="p-0">
                <div className="relative px-4 py-3 sm:px-5 sm:py-4">
                  <div className="absolute bottom-8 left-3 top-8 w-px bg-gradient-to-b from-[#4f46e5]/50 via-[#94a3b8] to-[#4f46e5]/50 sm:left-3.5" />

                  <div className="relative pl-7 sm:pl-8">
                    <div className="absolute left-2 top-1 h-2 w-2 rounded-full bg-[#4338ca] sm:left-2.5" />
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#4338ca]">Trip starts</p>
                    <p className="text-sm font-medium text-[#334155]">{formatTimelineDate(trip.start_date)}</p>
                  </div>

                  <div className="mt-2 space-y-0.5">
                    {items.map((item, index) => {
                      const gapLabel = index < items.length - 1 ? formatGapLabel(item, items[index + 1]) : null
                      return (
                        <div key={item.id}>
                          <div className="relative border-b border-[#f1f5f9] pl-7 last:border-0 sm:pl-8">
                            <div className="absolute left-[7px] top-8 h-2.5 w-2.5 rounded-full border-2 border-[#4f46e5] bg-white sm:left-2" />
                            <TripItemRow item={item} durationLabel={getItemDurationLabel(item)} />
                          </div>
                          {gapLabel && (
                            <div className="relative pl-7 py-1.5 sm:pl-8">
                              <p className="text-xs font-medium text-[#475569]">{gapLabel}</p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div className="relative mt-2 pl-7 sm:pl-8">
                    <div className="absolute left-2 top-1 h-2 w-2 rounded-full bg-[#4338ca] sm:left-2.5" />
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#4338ca]">Trip ends</p>
                    <p className="text-sm font-medium text-[#334155]">
                      {formatTimelineDate(trip.end_date ?? trip.start_date)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="py-12 text-center text-gray-400">
              <CalendarDays className="mx-auto mb-3 h-10 w-10 opacity-40" />
              <p className="text-sm">No items in this trip yet.</p>
            </div>
          )}

          <Card className="mt-6 border-[#cbd5e1] bg-gradient-to-r from-[#f8fafc] to-white">
            <CardContent className="p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-[#1e293b]">
                  Upgrade to Pro for live flight status, weather forecasts, and family sharing - $1/month
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-lg bg-[#4338ca] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#312e81]"
                >
                  Try Pro free
                </Link>
              </div>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-xs text-gray-400">
            Confirmation codes and full traveler details are hidden from shared views.
          </p>
        </div>
      </main>

      <footer className="border-t border-[#cbd5e1] bg-white">
        <div className="mx-auto max-w-4xl px-4 py-10 text-center sm:px-6">
          <Image
            src="/ubtrippin_logo.png"
            alt="UBTRIPPIN"
            width={40}
            height={40}
            className="mx-auto mb-3 rounded-xl"
          />
          <h2 className="text-lg font-semibold text-gray-900">
            Organize your trips with UBTRIPPIN
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">
            Automatically extract travel bookings from your inbox and keep your
            entire itinerary in one beautiful place.
          </p>
          <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/"
              className="inline-flex items-center rounded-lg bg-[#1e293b] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#312e81]"
            >
              Get started - it&apos;s free
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center rounded-lg border border-[#4338ca] px-5 py-2.5 text-sm font-semibold text-[#4338ca] transition-colors hover:bg-[#eef2ff]"
            >
              Try Pro free
            </Link>
          </div>
          <p className="mt-4 text-xs text-gray-400">
            &copy; {new Date().getFullYear()} UBTRIPPIN
          </p>
        </div>
      </footer>
    </div>
  )
}
