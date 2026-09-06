import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { MapPin, Calendar, Users } from 'lucide-react'
import { AcceptInviteButton } from './accept-button'
import { formatDateRange } from '@/lib/utils'

interface InvitePageProps {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params

  // Lookup the invite (public — no auth required yet)
  const supabase = await createClient()

  const { data: previewRows, error } = await supabase.rpc(
    'preview_trip_collaborator_invite',
    { p_token: token }
  )
  const invite = (previewRows as Array<{
    trip_id: string
    trip_title: string
    primary_location: string | null
    start_date: string | null
    end_date: string | null
    cover_image_url: string | null
    traveler_count: number
    role: string
    invited_email_hint: string
    inviter_name: string
  }> | null)?.[0]

  if (error || !invite) {
    notFound()
  }

  const tripData = {
    id: invite.trip_id,
    title: invite.trip_title,
    primary_location: invite.primary_location,
    start_date: invite.start_date,
    end_date: invite.end_date,
    cover_image_url: invite.cover_image_url,
    traveler_count: invite.traveler_count,
  }

  const inviterName = invite.inviter_name
  const tripLabel = tripData.primary_location || tripData.title

  // Check if the current user is logged in
  const userSupabase = await createClient()
  const { data: { user } } = await userSupabase.auth.getUser()

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <Image
            src="/ubtrippin_logo_simple.png"
            alt="UBTRIPPIN"
            width={240}
            height={83}
            className="mx-auto blend-multiply"
            priority
          />
        </div>

        {/* Invite card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Cover image */}
          {tripData.cover_image_url && (
            <div className="relative h-40 w-full">
              <Image
                src={tripData.cover_image_url}
                alt={tripLabel}
                fill
                className="object-cover"
                sizes="448px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            </div>
          )}

          <div className="p-8 space-y-6">
            {/* Invite message */}
            <div className="space-y-2">
              <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">
                You&apos;re invited
              </p>
              <h1 className="text-2xl font-bold text-gray-900">
                {inviterName} invited you to their {tripLabel} trip
              </h1>
              <p className="text-gray-600">
                {invite.role === 'editor'
                  ? 'You can view the full itinerary and add items.'
                  : 'You can view the full itinerary.'}
              </p>
            </div>

            {/* Trip details */}
            <div className="space-y-2 bg-slate-50 rounded-xl p-4">
              <div className="font-semibold text-gray-900">{tripData.title}</div>

              {tripData.primary_location && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  {tripData.primary_location}
                </div>
              )}

              {(tripData.start_date || tripData.end_date) && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  {formatDateRange(tripData.start_date, tripData.end_date)}
                </div>
              )}

              {tripData.traveler_count > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users className="h-4 w-4 text-gray-400" />
                  {tripData.traveler_count} traveler{tripData.traveler_count !== 1 ? 's' : ''}
                </div>
              )}
            </div>

            {/* CTA */}
            <AcceptInviteButton
              token={token}
              tripId={tripData.id}
              isLoggedIn={!!user}
            />
          </div>
        </div>

        <p className="text-center text-xs text-gray-400">
          If you didn&apos;t expect this invite, you can safely ignore this page.
        </p>
      </div>
    </div>
  )
}
