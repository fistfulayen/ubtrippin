import { NextResponse } from 'next/server'
import { requireSessionAuth, isSessionAuthError } from '@/lib/api/session-auth'
import { isValidUUID } from '@/lib/validation'

export interface FamilyMemberRow {
  user_id: string
  role: 'admin' | 'member'
}

export interface FamilyAccessContext {
  supabase: import('@supabase/supabase-js').SupabaseClient
  viewerId: string
  familyId: string
  members: FamilyMemberRow[]
}

export async function requireFamilyAccess(
  familyId: string
): Promise<{ ctx: FamilyAccessContext } | { response: NextResponse }> {
  if (!isValidUUID(familyId)) {
    return {
      response: NextResponse.json(
        { error: { code: 'invalid_param', message: 'Family ID must be a valid UUID.' } },
        { status: 400 }
      ),
    }
  }

  const auth = await requireSessionAuth()
  if (isSessionAuthError(auth)) {
    return { response: auth }
  }
  const { supabase, userId: viewerId } = auth

  const { data: viewerMembership } = await supabase
    .from('family_members')
    .select('id')
    .eq('family_id', familyId)
    .eq('user_id', viewerId)
    .not('accepted_at', 'is', null)
    .maybeSingle()

  if (!viewerMembership) {
    return {
      response: NextResponse.json(
        { error: { code: 'not_found', message: 'Family not found.' } },
        { status: 404 }
      ),
    }
  }

  const { data: memberRows, error: memberError } = await supabase
    .from('family_members')
    .select('user_id, role')
    .eq('family_id', familyId)
    .not('accepted_at', 'is', null)

  if (memberError) {
    console.error('[families/:id helper] member lookup failed', memberError)
    return {
      response: NextResponse.json(
        { error: { code: 'internal_error', message: 'Failed to load family members.' } },
        { status: 500 }
      ),
    }
  }

  const members = (memberRows ?? []).filter(
    (row): row is FamilyMemberRow =>
      typeof row.user_id === 'string' &&
      (row.role === 'admin' || row.role === 'member')
  )

  return {
    ctx: {
      supabase,
      viewerId,
      familyId,
      members,
    },
  }
}
