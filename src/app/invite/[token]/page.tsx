import { createClient } from '@/lib/supabase/server'
import { createSecretClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
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
  const supabase = createSecretClient()

  const { data: invite, error } = await supabase
    .from('trip_collaborators')
    .select(`
      id,
      role,
      invited_email,
      accepted_at,
      invite_token,
      trip:trips (
        id,
        title,
        primary_location,
        start_date,
        end_date,
        cover_image_url,
        travelers
      ),
      inviter:profiles!invited_by (
        full_name,
        email
      )
    `)
    .eq('invite_token', token)
    .maybeSingle()

  if (error || !invite) {
    notFound()
  }

  if (invite.accepted_at) {
    // Already accepted — redirect to the trip if logged in, else to login
    const userSupabase = await createClient()
    const { data: { user } } = await userSupabase.auth.getUser()
    if (user) {
      const tripData = invite.trip as unknown as { id?: string } | null
      redirect(`/trips/${tripData?.id}`)
    }
    redirect('/login')
  }

  const tripData = invite.trip as unknown as {
    id: string
    title: string
    primary_location: string | null
    start_date: string | null
    end_date: string | null
    cover_image_url: string | null
    travelers: string[]
  } | null

  const inviterData = invite.inviter as unknown as {
    full_name: string | null
    email: string | null
  } | null

  if (!tripData) notFound()

  const inviterName = inviterData?.full_name || inviterData?.email || 'Someone'
  const tripLabel = tripData.primary_location || tripData.title

  // Check if the current user is logged in
  const userSupabase = await createClient()
  const { data: { user } } = await userSupabase.auth.getUser()

  // If logged in but wrong email — show error
  if (user && user.email?.toLowerCase() !== invite.invited_email.toLowerCase()) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 space-y-6 text-center">
          <div className="text-4xl">🔒</div>
          <h1 className="text-xl font-bold text-gray-900">Wrong account</h1>
          <p className="text-gray-600">
            This invite was sent to <strong>{invite.invited_email}</strong>. You&apos;re signed in
            as <strong>{user.email}</strong>.
          </p>
          <p className="text-sm text-gray-500">
            Please sign out and sign in with the invited email address to accept this invite.
          </p>
        </div>
      </div>
    )
  }

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

              {tripData.travelers && tripData.travelers.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users className="h-4 w-4 text-gray-400" />
                  {tripData.travelers.length} traveler{tripData.travelers.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>

            {/* CTA */}
            <AcceptInviteButton
              token={token}
              tripId={tripData.id}
              invitedEmail={invite.invited_email}
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
