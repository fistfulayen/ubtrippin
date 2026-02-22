import { createClient } from '@/lib/supabase/server'
import { TripCard } from '@/components/trips/trip-card'
import { Button } from '@/components/ui/button'
import { Plus, Mail, MapPin } from 'lucide-react'
import Link from 'next/link'

export default async function TripsPage() {
  const supabase = await createClient()

  const { data: trips } = await supabase
    .from('trips')
    .select('*, trip_items(id, kind, needs_review)')
    .order('start_date', { ascending: true })

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

  return (
    <div className="space-y-8">
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

      {!hasTrips ? (
        /* Empty state */
        <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/50 p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <MapPin className="h-8 w-8 text-amber-600" />
          </div>
          <h3 className="mt-6 text-lg font-semibold text-gray-900">
            No trips yet
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-gray-600">
            Forward your first booking confirmation email to get started, or create a trip manually.
          </p>
          <div className="mt-6 flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 font-mono text-sm shadow-sm border border-amber-200">
              <Mail className="h-4 w-4 text-amber-600" />
              trips@ubtrippin.xyz
            </div>
            <span className="text-sm text-gray-500">or</span>
            <Link href="/trips/new">
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Create trip manually
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Current trips */}
          {currentTrips.length > 0 && (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Current Trip{currentTrips.length > 1 ? 's' : ''}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {currentTrips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    itemCount={trip.trip_items?.length ?? 0}
                    needsReview={
                      trip.trip_items?.some((item: { needs_review: boolean }) => item.needs_review) ?? false
                    }
                  />
                ))}
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
                {upcomingTrips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    itemCount={trip.trip_items?.length ?? 0}
                    needsReview={
                      trip.trip_items?.some((item: { needs_review: boolean }) => item.needs_review) ?? false
                    }
                  />
                ))}
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
                {pastTrips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    itemCount={trip.trip_items?.length ?? 0}
                    needsReview={false}
                    isPast
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Info box */}
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
        <h3 className="font-medium text-amber-900">Quick tip</h3>
        <p className="mt-1 text-sm text-amber-800">
          Forward booking emails from your registered email address to{' '}
          <strong>trips@ubtrippin.xyz</strong> to automatically create and organize trips.
          Make sure to add your sending email address in{' '}
          <Link href="/settings" className="underline hover:text-amber-900">
            Settings
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
