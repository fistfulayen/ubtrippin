import { createClient } from '@/lib/supabase/server'
import { createSecretClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { TripHeader } from '@/components/trips/trip-header'
import { TripTimeline } from '@/components/trips/trip-timeline'
import { TripActions } from '@/components/trips/trip-actions'
import { CollaboratorsSection } from '@/components/trips/collaborators-section'
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

  // Fetch trip (explicit user filter + RLS as backup)
  const secretClient1 = createSecretClient()
  const { data: trip, error } = await secretClient1
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
    const secretClient = createSecretClient()
    const { data: collab } = await secretClient
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

  const { data: items } = await secretClient1
    .from('trip_items')
    .select('*')
    .eq('trip_id', id)
    .eq('user_id', trip.user_id)
    .order('start_date', { ascending: true })
    .order('start_ts', { ascending: true })

  // Get all user's trips for move item dialog
  const { data: allTrips } = user
    ? await secretClient1
        .from('trips')
        .select('id, title, start_date')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false })
    : { data: null }

  // Fetch collaborators (only for owner — service client to bypass per-row RLS)
  const secretClient = createSecretClient()
  const { data: collaborators } = isOwner
    ? await secretClient
        .from('trip_collaborators')
        .select('id, user_id, role, invited_email, accepted_at, created_at')
        .eq('trip_id', id)
        .order('created_at', { ascending: true })
    : { data: [] }

  const canEdit = isOwner || collabRole === 'editor'

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

      {/* Trip header with title, dates, location */}
      <TripHeader trip={trip} />

      {/* Actions bar — show to owners and editors */}
      {canEdit && (
        <TripActions trip={trip} allTrips={allTrips || []} isOwner={isOwner} />
      )}

      {/* Collaborators section */}
      <CollaboratorsSection
        tripId={id}
        collaborators={collaborators || []}
        isOwner={isOwner}
      />

      {/* Timeline */}
      <TripTimeline items={items || []} tripId={trip.id} allTrips={allTrips || []} />
    </div>
  )
}
