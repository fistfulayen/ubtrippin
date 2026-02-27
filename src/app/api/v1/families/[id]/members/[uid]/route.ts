import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidUUID } from '@/lib/validation'

type Params = { params: Promise<{ id: string; uid: string }> }

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id: familyId, uid: memberId } = await params

  if (!isValidUUID(familyId) || !isValidUUID(memberId)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Family ID and member ID must be valid UUIDs.' } },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Authentication required.' } },
      { status: 401 }
    )
  }

  const { data: requesterMembership } = await supabase
    .from('family_members')
    .select('id, role, user_id')
    .eq('family_id', familyId)
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .maybeSingle()

  if (!requesterMembership) {
    return NextResponse.json(
      { error: { code: 'forbidden', message: 'You are not a member of this family.' } },
      { status: 403 }
    )
  }

  const { data: targetMembership } = await supabase
    .from('family_members')
    .select('id, user_id, role')
    .eq('id', memberId)
    .eq('family_id', familyId)
    .maybeSingle()

  if (!targetMembership) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Family member not found.' } },
      { status: 404 }
    )
  }

  const isSelf = targetMembership.user_id === user.id
  const isAdmin = requesterMembership.role === 'admin'

  if (!isSelf && !isAdmin) {
    return NextResponse.json(
      { error: { code: 'forbidden', message: 'Only admins can remove other family members.' } },
      { status: 403 }
    )
  }

  const { error: deleteError } = await supabase
    .from('family_members')
    .delete()
    .eq('id', memberId)
    .eq('family_id', familyId)

  if (deleteError) {
    console.error('[v1/families/:id/members/:uid DELETE] failed', deleteError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to remove family member.' } },
      { status: 500 }
    )
  }

  return new NextResponse(null, { status: 204 })
}
