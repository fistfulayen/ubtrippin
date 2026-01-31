import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { TripHeader } from '@/components/trips/trip-header'
import { TripTimeline } from '@/components/trips/trip-timeline'
import { TripActions } from '@/components/trips/trip-actions'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface TripPageProps {
  params: Promise<{ id: string }>
}

export default async function TripPage({ params }: TripPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: trip, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !trip) {
    notFound()
  }

  const { data: items } = await supabase
    .from('trip_items')
    .select('*')
    .eq('trip_id', id)
    .order('start_date', { ascending: true })
    .order('start_ts', { ascending: true })

  // Get all user's trips for move item dialog
  const { data: allTrips } = await supabase
    .from('trips')
    .select('id, title, start_date')
    .order('start_date', { ascending: false })

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

      {/* Trip header with title, dates, location */}
      <TripHeader trip={trip} />

      {/* Actions bar */}
      <TripActions trip={trip} allTrips={allTrips || []} />

      {/* Timeline */}
      <TripTimeline items={items || []} tripId={trip.id} allTrips={allTrips || []} />
    </div>
  )
}
