import { createSecretClient } from '@/lib/supabase/server'
import { formatDateRange, formatDate, getKindIcon } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
import { getProviderLogoUrl } from '@/lib/images/provider-logo'
import { AirlineLogoIcon } from './airline-logo-icon'
import type { TripItem, TripItemKind } from '@/types/database'

interface SharePageProps {
  params: Promise<{ token: string }>
}

/** Return first name + last initial only (e.g. "John Smith" → "John S.") */
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
  other: 'bg-gray-100 text-gray-800',
}

function TripItemRow({ item }: { item: TripItem }) {
  const names = item.traveler_names.map(obfuscateName)
  const location =
    item.start_location && item.end_location
      ? `${item.start_location} → ${item.end_location}`
      : item.start_location || item.end_location || null
  const airlineLogoUrl = item.kind === 'flight' && item.provider
    ? getProviderLogoUrl(item.provider, item.kind)
    : null

  return (
    <div className="flex items-start gap-3 py-4 border-b border-[#f1f5f9] last:border-0">
      {/* Icon — airline logo for flights, generic icon for others */}
      {airlineLogoUrl ? (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white border border-gray-200 overflow-hidden">
          <AirlineLogoIcon url={airlineLogoUrl} alt={item.provider || 'Airline'} />
        </div>
      ) : (
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${kindColors[item.kind]}`}
        >
          <KindIcon kind={item.kind} className="h-4 w-4" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-gray-900">
            {item.provider ?? capitalise(item.kind)}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${kindColors[item.kind]}`}
          >
            {capitalise(item.kind)}
          </span>
        </div>

        {item.summary && (
          <p className="mt-0.5 text-sm text-gray-600 leading-snug">{item.summary}</p>
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

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params
  const supabase = createSecretClient()

  // SECURITY: Validate token format before querying — nanoid(21) produces URL-safe chars only
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(token)) {
    return (
      <div className="min-h-screen bg-[#ffffff] flex items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Trip not found</h1>
          <p className="mt-2 text-gray-500">This trip either doesn&apos;t exist or sharing has been disabled.</p>
        </div>
      </div>
    )
  }

  // SECURITY: Select only fields needed for display — exclude sensitive fields (confirmation_code, etc.)
  // Note: service-role client is required here since visitors are unauthenticated.
  // RLS is intentionally bypassed; share_enabled check acts as the gate.
  const { data: trip } = await supabase
    .from('trips')
    .select('id, title, start_date, end_date, primary_location, travelers, notes, cover_image_url, share_enabled')
    .eq('share_token', token)
    .eq('share_enabled', true)
    .single()

  if (!trip) {
    return (
      <div className="min-h-screen bg-[#ffffff] flex flex-col">
        {/* Header */}
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
              className="mt-6 inline-flex items-center rounded-lg bg-[#1e293b] px-4 py-2 text-sm font-medium text-white hover:bg-[#312e81] transition-colors"
            >
              Plan your own trip with UBTRIPPIN
            </Link>
          </div>
        </main>
      </div>
    )
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
  const items = rawItems?.map((item) => {
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

  const travelers = (trip.travelers ?? []).map(obfuscateName)

  // Group items by kind for a tidy summary count
  const itemCount = items?.length ?? 0

  return (
    <div className="min-h-screen bg-[#ffffff] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-[#cbd5e1] bg-white/90 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/ubtrippin_logo.png" alt="UBTRIPPIN" width={28} height={28} className="rounded-lg" />
            <span className="text-base font-bold text-[#4338ca]">UBTRIPPIN</span>
          </Link>
          <Link
            href="/"
            className="rounded-lg bg-[#1e293b] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#312e81] transition-colors"
          >
            Plan your trip free
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero / Trip Header */}
        <div className="relative overflow-hidden">
          {trip.cover_image_url ? (
            <>
              <div className="relative h-64 sm:h-80 w-full">
                <Image
                  src={trip.cover_image_url}
                  alt={trip.title}
                  fill
                  className="object-cover"
                  priority
                  sizes="100vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                <div className="mx-auto max-w-4xl">
                  <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
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
            <div className="bg-gradient-to-r from-[#f1f5f9] to-[#ffffff] py-10 px-6 sm:px-8">
              <div className="mx-auto max-w-4xl">
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">
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

        {/* Main content */}
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          {/* Summary strip */}
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

          {/* Notes */}
          {trip.notes && (
            <Card className="mb-6 border-[#cbd5e1] bg-[#ffffff]">
              <CardContent className="p-4">
                <p className="text-sm text-gray-700 leading-relaxed">{trip.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Trip Items */}
          {items && items.length > 0 ? (
            <Card className="border-[#cbd5e1]">
              <CardContent className="p-0">
                <div className="divide-y divide-[#f1f5f9]">
                  {items.map((item) => (
                    <div key={item.id} className="px-5">
                      <TripItemRow item={item as any} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <CalendarDays className="mx-auto h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">No items in this trip yet.</p>
            </div>
          )}

          {/* Privacy note */}
          <p className="mt-6 text-center text-xs text-gray-400">
            Confirmation codes and full traveler details are hidden from shared views.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#cbd5e1] bg-white">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 text-center">
          <Image
            src="/ubtrippin_logo.png"
            alt="UBTRIPPIN"
            width={40}
            height={40}
            className="mx-auto rounded-xl mb-3"
          />
          <h2 className="text-lg font-semibold text-gray-900">
            Organize your trips with UBTRIPPIN
          </h2>
          <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">
            Automatically extract travel bookings from your inbox and keep your
            entire itinerary in one beautiful place.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex items-center rounded-lg bg-[#1e293b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#312e81] transition-colors shadow-sm"
          >
            Get started — it&apos;s free
          </Link>
          <p className="mt-4 text-xs text-gray-400">
            &copy; {new Date().getFullYear()} UBTRIPPIN
          </p>
        </div>
      </footer>
    </div>
  )
}
