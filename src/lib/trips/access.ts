import { createSecretClient } from '@/lib/supabase/service'

export type TripWriteAccessRole = 'owner' | 'editor' | 'family_member'
export type TripWriteDeniedReason = 'not_found' | 'forbidden' | 'viewer' | 'internal_error'

interface TripOwnerRow {
  id: string
  user_id: string
}

type SupabaseSecretClient = ReturnType<typeof createSecretClient>

export type TripWriteAccessResult =
  | {
      allowed: true
      role: TripWriteAccessRole
      trip: TripOwnerRow
    }
  | {
      allowed: false
      reason: TripWriteDeniedReason
      trip?: TripOwnerRow
    }

interface ResolveTripWriteAccessParams {
  supabase: SupabaseSecretClient
  tripId: string
  userId: string
}

interface FamilyMembershipRow {
  family_id: string
}

interface CollaboratorRow {
  role: 'editor' | 'viewer' | 'owner'
}

/**
 * API-key authorization helper for trip writes.
 * Allowed if caller is:
 * - trip owner
 * - accepted editor collaborator
 * - accepted family member of the trip owner
 */
export async function resolveTripWriteAccess({
  supabase,
  tripId,
  userId,
}: ResolveTripWriteAccessParams): Promise<TripWriteAccessResult> {
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('id, user_id')
    .eq('id', tripId)
    .maybeSingle()

  if (tripError) return { allowed: false, reason: 'internal_error' }
  if (!trip) return { allowed: false, reason: 'not_found' }

  if (trip.user_id === userId) {
    return { allowed: true, role: 'owner', trip }
  }

  let viewerOnly = false

  const { data: collab, error: collabError } = await supabase
    .from('trip_collaborators')
    .select('role')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .not('accepted_at', 'is', null)
    .maybeSingle()

  if (collabError) return { allowed: false, reason: 'internal_error' }

  if (collab) {
    const role = (collab as CollaboratorRow).role
    if (role === 'editor' || role === 'owner') {
      return { allowed: true, role: 'editor', trip }
    }
    viewerOnly = role === 'viewer'
  }

  const { data: viewerFamilies, error: viewerFamiliesError } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', userId)
    .not('accepted_at', 'is', null)

  if (viewerFamiliesError) return { allowed: false, reason: 'internal_error' }

  const familyIds = ((viewerFamilies ?? []) as FamilyMembershipRow[])
    .map((row) => row.family_id)
    .filter((familyId): familyId is string => typeof familyId === 'string')

  if (familyIds.length > 0) {
    const { data: ownerFamilyMember, error: ownerFamilyError } = await supabase
      .from('family_members')
      .select('id')
      .eq('user_id', trip.user_id)
      .in('family_id', familyIds)
      .not('accepted_at', 'is', null)
      .limit(1)
      .maybeSingle()

    if (ownerFamilyError) return { allowed: false, reason: 'internal_error' }

    if (ownerFamilyMember) {
      return { allowed: true, role: 'family_member', trip }
    }
  }

  return {
    allowed: false,
    reason: viewerOnly ? 'viewer' : 'forbidden',
    trip,
  }
}
