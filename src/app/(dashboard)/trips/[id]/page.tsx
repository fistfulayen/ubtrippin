import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { TripHeader } from '@/components/trips/trip-header'
import { MovementTimeline } from '@/components/trips/movement-timeline'
import { TripActions } from '@/components/trips/trip-actions'
import { CollaboratorsSection } from '@/components/trips/collaborators-section'
import { DemoTripBanner } from '@/components/trips/demo-trip-banner'
import { WeatherSection } from '@/components/trips/weather/weather-section'
import { attachWeatherToTimeline, buildTimeline } from '@/lib/trips/city-segments'
import { getTemperatureUnit, getTripWeather } from '@/lib/weather/service'
import { ArrowLeft, Users } from 'lucide-react'
import Link from 'next/link'

interface TripPageProps {
  params: Promise<{ id: string }>
}

export default async function TripPage({ params }: TripPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: trip, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !trip) {
    notFound()
  }

  const isOwner = trip.user_id === user?.id

  // Fetch collaborator record if user is not owner (to get their role)
  let collabRole: string | null = null
  let inviterName: string | null = null

  if (!isOwner && user) {
    const { data: collab } = await supabase
      .from('trip_collaborators')
      .select('role, inviter:profiles!invited_by (full_name, email)')
      .eq('trip_id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (collab) {
      collabRole = collab.role
      const inviterData = collab.inviter as { full_name?: string; email?: string } | null
      inviterName = inviterData?.full_name || inviterData?.email || null
    }
  }

  // Parallel: fetch items, all trips, collaborators, profile, and temp unit simultaneously
  const [
    { data: items },
    { data: allTrips },
    { data: collaborators },
    { data: profileData },
    userUnit,
  ] = await Promise.all([
    supabase
      .from('trip_items')
      .select('*')
      .eq('trip_id', id)
      .order('start_date', { ascending: true })
      .order('start_ts', { ascending: true }),
    user
      ? supabase
          .from('trips')
          .select('id, title, start_date')
          .order('start_date', { ascending: false })
      : Promise.resolve({ data: null }),
    isOwner
      ? supabase
          .from('trip_collaborators')
          .select('id, user_id, role, invited_email, accepted_at, created_at')
          .eq('trip_id', id)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as never[] }),
    user
      ? supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? getTemperatureUnit(user.id, supabase)
      : Promise.resolve('fahrenheit' as const),
  ])

  const canEdit = isOwner || collabRole === 'editor'
  const isPro = profileData?.subscription_tier === 'pro'
  const weather = user
    ? await getTripWeather({
        tripId: trip.id,
        supabase,
        userId: user.id,
        requestedUnit: userUnit,
        includePacking: isPro,
      })
    : null
  const timeline = attachWeatherToTimeline(buildTimeline(items || []), weather?.destinations ?? [])

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/trips"
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to trips
      </Link>

      {/* "Shared by" notice for collaborators */}
      {!isOwner && inviterName && (
        <div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm text-indigo-700">
          <Users className="h-4 w-4 shrink-0" />
          <span>
            Shared by <strong>{inviterName}</strong>
            {collabRole === 'viewer' && ' — view only'}
          </span>
        </div>
      )}

      {trip.is_demo && <DemoTripBanner />}

      {/* Trip header with title, dates, location */}
      <TripHeader trip={trip} />

      {/* Actions bar — show to owners and editors */}
      {canEdit && (
        <TripActions trip={trip} allTrips={allTrips || []} isOwner={isOwner} isPro={isPro} />
      )}

      {/* Collaborators section */}
      <CollaboratorsSection
        tripId={id}
        collaborators={collaborators || []}
        isOwner={isOwner}
      />

      <MovementTimeline entries={timeline} allTrips={allTrips || []} currentUserId={user?.id} />

      <WeatherSection endpoint={`/api/trips/${trip.id}/weather`} initialData={weather} showPacking />
    </div>
  )
}
