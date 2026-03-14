import { cache } from 'react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Calendar, CalendarDays, MapPin, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createSecretClient } from '@/lib/supabase/service'
import { formatDateRange } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { WeatherSection } from '@/components/trips/weather/weather-section'
import { buildWeatherPayload, getTemperatureUnit, getTripWeather } from '@/lib/weather/service'
import type { Json, TripItem } from '@/types/database'
import type { WeatherTripItem } from '@/lib/weather/types'
import { attachWeatherToTimeline, buildTimeline } from '@/lib/trips/city-segments'
import { attachCityHeroes } from '@/lib/trips/city-heroes'
import { MovementTimeline } from '@/components/trips/movement-timeline'
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

function obfuscateName(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}

const isValidShareToken = (token: string) => /^[A-Za-z0-9_-]{10,64}$/.test(token)

function normaliseCityLabel(location: string) {
  const city = location.split(',')[0].trim()
  return city.replace(/[^\p{L}\p{N}\s.\-']/gu, '').slice(0, 100)
}

function buildTripSummaryDescription(trip: ShareTrip, items: TripItem[] | null) {
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

const getSharedTripData = cache(async (token: string): Promise<{ trip: ShareTrip | null; items: TripItem[] | null }> => {
  if (!isValidShareToken(token)) {
    return { trip: null, items: null }
  }

  const supabase = createSecretClient()
  const { data: tripRow } = await supabase
    .from('trips')
    .select('id, title, start_date, end_date, primary_location, travelers, notes, cover_image_url, share_enabled')
    .eq('share_token', token)
    .eq('share_enabled', true)
    .single()

  const trip = tripRow as ShareTrip | null
  if (!trip) return { trip: null, items: null }

  const { data: rawItems } = await supabase
    .from('trip_items')
    .select('id, kind, provider, traveler_names, start_date, end_date, start_ts, end_ts, start_location, end_location, summary, needs_review, status, details_json')
    .eq('trip_id', trip.id)
    .order('start_date', { ascending: true })
    .order('start_ts', { ascending: true })

  const items = rawItems?.map((item): TripItem => {
    let safeDetails: Record<string, unknown> | null = null
    if (item.details_json && typeof item.details_json === 'object' && !Array.isArray(item.details_json)) {
      const { confirmation_code, booking_reference, ...remaining } = item.details_json as Record<string, unknown>
      void confirmation_code
      void booking_reference
      safeDetails = remaining
    }

    return {
      id: item.id,
      user_id: '',
      trip_id: trip.id,
      kind: item.kind,
      provider: item.provider,
      confirmation_code: null,
      traveler_names: item.traveler_names ?? [],
      start_ts: item.start_ts,
      end_ts: item.end_ts,
      start_date: item.start_date,
      end_date: item.end_date,
      start_location: item.start_location,
      end_location: item.end_location,
      summary: item.summary,
      details_json: (safeDetails ?? {}) as Json,
      status: item.status,
      confidence: 1,
      needs_review: item.needs_review,
      loyalty_flag: null,
      source_email_id: null,
      created_at: '',
      updated_at: '',
    }
  }) ?? null

  return { trip, items }
})

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
            <p className="mt-2 text-gray-500">This trip either doesn&apos;t exist or sharing has been disabled.</p>
          </div>
        </main>
      </div>
    )
  }

  // Parallel: auth check runs alongside weather fetch
  const sessionSupabase = await createClient()

  const obfuscatedItems = (items ?? []).map((item) => ({
    ...item,
    user_id: '',
    traveler_names: item.traveler_names.map(obfuscateName),
  }))
  const travelers = (trip.travelers ?? []).map(obfuscateName)
  const itemCount = obfuscatedItems.length

  // Start auth check early — don't block on it
  const userPromise = sessionSupabase.auth.getUser()

  // Build anonymous weather payload while auth resolves
  const weatherItems = items?.map(
    (item): WeatherTripItem => ({
      id: item.id,
      trip_id: trip.id,
      kind: item.kind,
      start_date: item.start_date,
      end_date: item.end_date,
      start_ts: item.start_ts,
      end_ts: item.end_ts,
      start_location: item.start_location,
      end_location: item.end_location,
      provider: item.provider,
      summary: item.summary,
      details_json: item.details_json,
    })
  )

  const anonWeatherPromise = items
    ? buildWeatherPayload({
        trip: {
          id: trip.id,
          user_id: '',
          title: trip.title,
          start_date: trip.start_date,
          end_date: trip.end_date,
          share_enabled: trip.share_enabled ?? false,
        },
        items: weatherItems!,
        unit: 'fahrenheit',
        includePacking: false,
      })
    : Promise.resolve(null)

  // Wait for both in parallel
  const [{ data: { user } }, anonWeather] = await Promise.all([userPromise, anonWeatherPromise])

  let sharedWeather = anonWeather
  let showPacking = false

  if (user) {
    // Parallel: trip access check + temperature unit fetch
    const [{ data: accessibleTrip }, userUnit] = await Promise.all([
      sessionSupabase
        .from('trips')
        .select('id, user_id')
        .eq('id', trip.id)
        .maybeSingle(),
      getTemperatureUnit(user.id, sessionSupabase),
    ])

    if (accessibleTrip) {
      const { data: ownerProfile } = await sessionSupabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', accessibleTrip.user_id)
        .maybeSingle()

      showPacking = ownerProfile?.subscription_tier === 'pro'
      sharedWeather = await getTripWeather({
        tripId: trip.id,
        supabase: sessionSupabase,
        userId: user.id,
        requestedUnit: userUnit,
        includePacking: showPacking,
      })
    }
  }

  const supabaseForHeroes = createSecretClient()
  const weatherTimeline = attachWeatherToTimeline(buildTimeline(obfuscatedItems), sharedWeather?.destinations ?? [])
  const timeline = await attachCityHeroes(weatherTimeline, supabaseForHeroes)

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
                  <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl">{trip.title}</h1>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-white/90">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      {formatDateRange(trip.start_date, trip.end_date)}
                    </span>
                    {trip.primary_location ? (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4" />
                        {trip.primary_location}
                      </span>
                    ) : null}
                    {travelers.length > 0 ? (
                      <span className="flex items-center gap-1.5">
                        <Users className="h-4 w-4" />
                        {travelers.join(', ')}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-gradient-to-r from-[#f1f5f9] to-[#ffffff] px-6 py-10 sm:px-8">
              <div className="mx-auto max-w-4xl">
                <h1 className="text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">{trip.title}</h1>
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-700">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-[#4f46e5]" />
                    {formatDateRange(trip.start_date, trip.end_date)}
                  </span>
                  {trip.primary_location ? (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-[#4f46e5]" />
                      {trip.primary_location}
                    </span>
                  ) : null}
                  {travelers.length > 0 ? (
                    <span className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-[#4f46e5]" />
                      {travelers.join(', ')}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          {itemCount > 0 ? (
            <div className="mb-6 flex flex-wrap gap-3">
              <Badge variant="secondary" className="text-xs">
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </Badge>
              {trip.primary_location ? (
                <Badge variant="default" className="text-xs">
                  <MapPin className="mr-1 h-3 w-3" />
                  {trip.primary_location}
                </Badge>
              ) : null}
            </div>
          ) : null}

          {trip.notes ? (
            <Card className="mb-6 border-[#cbd5e1] bg-[#ffffff]">
              <CardContent className="p-4">
                <p className="text-sm leading-relaxed text-gray-700">{trip.notes}</p>
              </CardContent>
            </Card>
          ) : null}

          {sharedWeather ? (
            <div className="mb-6">
              <WeatherSection
                endpoint={`/api/trips/${trip.id}/weather`}
                initialData={sharedWeather}
                allowRefresh={false}
                shareMode={!showPacking}
                showPacking={showPacking}
              />
            </div>
          ) : null}

          {obfuscatedItems.length > 0 ? (
            <MovementTimeline entries={timeline} allTrips={[]} readOnly />
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
          <Image src="/ubtrippin_logo.png" alt="UBTRIPPIN" width={40} height={40} className="mx-auto rounded-lg" />
          <p className="mt-4 text-sm text-gray-500">AI-first travel intelligence for forwarded booking emails.</p>
        </div>
      </footer>
    </div>
  )
}
