import { createClient, createSecretClient } from '@/lib/supabase/server'
import { TripCard } from '@/components/trips/trip-card'
import { PWAInstallPrompt } from '@/components/pwa-install-prompt'
import { OnboardingCard } from '@/components/trips/onboarding-card'
import { FirstTripBanner } from '@/components/trips/first-trip-banner'
import { sendWelcomeEmail } from './actions'
import { Button } from '@/components/ui/button'
import { Plus, Mail, MapPin } from 'lucide-react'
import Link from 'next/link'

export default async function TripsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch profile for welcome email + onboarding state
  const { data: profile } = user
    ? await supabase
        .from('profiles')
        .select('welcome_email_sent, onboarding_completed, full_name, email')
        .eq('id', user.id)
        .single()
    : { data: null }

  // Send welcome email if not yet sent
  if (user && profile && !profile.welcome_email_sent) {
    await sendWelcomeEmail(
      user.id,
      profile.full_name || 'Traveler',
      profile.email || user.email || ''
    ).catch(() => {}) // swallow errors to not break page
  }

  // Service client + explicit user_id filter for data queries.
  // Cookie-based RLS is unreliable on Vercel despite correct config.
  // Cookie client used only for auth (getUser). This is intentional.
  const sc = createSecretClient()
  const { data: trips } = user
    ? await sc
        .from('trips')
        .select('*, trip_items(id, kind, needs_review, provider, details_json)')
        .eq('user_id', user.id)
        .order('start_date', { ascending: true })
    : { data: null }

  // Fetch shared trips (trips where user is a collaborator, not owner)
  const { data: sharedCollabs } = user
    ? await supabase
        .from('trip_collaborators')
        .select('trip_id, role, inviter:profiles!invited_by (full_name, email)')
        .eq('user_id', user.id)
        .not('accepted_at', 'is', null)
    : { data: null }

  // Build a map of trip_id → inviter name for "Shared by" labels
  const sharedTripMap = new Map<string, string>()
  for (const collab of sharedCollabs ?? []) {
    const inv = collab.inviter as { full_name?: string; email?: string } | null
    sharedTripMap.set(collab.trip_id, inv?.full_name || inv?.email || 'someone')
  }

  // All owned trip IDs (to distinguish shared)
  const ownedTripIds = new Set(
    (trips ?? []).filter((t) => t.user_id === user?.id).map((t) => t.id)
  )

  // Three trip states: current (started, not ended), upcoming (not started), past (ended)
  const today = new Date().toISOString().split('T')[0]
  const currentTrips = trips?.filter(
    (trip) => trip.start_date && trip.start_date <= today && (trip.end_date || trip.start_date) >= today
  ) || []
  const upcomingTrips = trips?.filter(
    (trip) => !trip.start_date || trip.start_date > today
  ) || []
  const pastTrips = trips?.filter(
    (trip) => trip.start_date && (trip.end_date || trip.start_date) < today
  )?.sort((a, b) => {
    // Reverse chronological — most recent past trips first
    const dateA = a.end_date || a.start_date || ''
    const dateB = b.end_date || b.start_date || ''
    return dateB.localeCompare(dateA)
  }) || []

  const hasTrips = (trips?.length ?? 0) > 0

  // Show first-trip celebration banner once, until dismissed
  const showFirstTripBanner = hasTrips && profile && !profile.onboarding_completed
  const firstTrip = trips?.[0]

  return (
    <div className="space-y-8">
      {/* PWA install prompt */}
      <PWAInstallPrompt />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your Trips</h1>
          <p className="text-gray-600">
            Manage and view all your travel itineraries
          </p>
        </div>
        <Link href="/trips/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Trip
          </Button>
        </Link>
      </div>

      {/* First trip celebration banner */}
      {showFirstTripBanner && firstTrip && (
        <FirstTripBanner tripId={firstTrip.id} tripTitle={firstTrip.title} />
      )}

      {!hasTrips ? (
        <OnboardingCard />
      ) : (
        <div className="space-y-8">
          {/* Current trips */}
          {currentTrips.length > 0 && (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Current Trip{currentTrips.length > 1 ? 's' : ''}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {currentTrips.map((trip) => {
                  const shared = !ownedTripIds.has(trip.id)
                  return (
                    <TripCard
                      key={trip.id}
                      trip={trip}
                      itemCount={trip.trip_items?.length ?? 0}
                      needsReview={
                        !shared && (trip.trip_items?.some((item: { needs_review: boolean }) => item.needs_review) ?? false)
                      }
                      isShared={shared}
                      sharedByName={shared ? sharedTripMap.get(trip.id) : undefined}
                    />
                  )
                })}
              </div>
            </section>
          )}

          {/* Upcoming trips */}
          {upcomingTrips.length > 0 && (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Upcoming
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {upcomingTrips.map((trip) => {
                  const shared = !ownedTripIds.has(trip.id)
                  return (
                    <TripCard
                      key={trip.id}
                      trip={trip}
                      itemCount={trip.trip_items?.length ?? 0}
                      needsReview={
                        !shared && (trip.trip_items?.some((item: { needs_review: boolean }) => item.needs_review) ?? false)
                      }
                      isShared={shared}
                      sharedByName={shared ? sharedTripMap.get(trip.id) : undefined}
                    />
                  )
                })}
              </div>
            </section>
          )}

          {/* Past trips */}
          {pastTrips.length > 0 && (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-gray-500">
                Past Trips
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pastTrips.map((trip) => {
                  const shared = !ownedTripIds.has(trip.id)
                  return (
                    <TripCard
                      key={trip.id}
                      trip={trip}
                      itemCount={trip.trip_items?.length ?? 0}
                      needsReview={false}
                      isPast
                      isShared={shared}
                      sharedByName={shared ? sharedTripMap.get(trip.id) : undefined}
                    />
                  )
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Info box */}
      <div className="rounded-xl bg-[#ffffff] border border-[#cbd5e1] p-4">
        <h3 className="font-medium text-[#1e293b]">Quick tip</h3>
        <p className="mt-1 text-sm text-[#1e293b]">
          Forward booking emails from your registered email address to{' '}
          <strong>trips@ubtrippin.xyz</strong> to automatically create and organize trips.
          Make sure to add your sending email address in{' '}
          <Link href="/settings" className="underline hover:text-[#1e293b]">
            Settings
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
