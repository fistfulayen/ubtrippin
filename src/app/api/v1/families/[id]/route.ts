import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSecretClient } from '@/lib/supabase/service'
import { isValidUUID } from '@/lib/validation'

function normalizeFamilyName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 120) return null
  return trimmed
}

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const { id: familyId } = await params
  if (!isValidUUID(familyId)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Family ID must be a valid UUID.' } },
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

  const { data: viewerMembership } = await supabase
    .from('family_members')
    .select('id, role')
    .eq('family_id', familyId)
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .maybeSingle()

  if (!viewerMembership) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Family not found.' } },
      { status: 404 }
    )
  }

  const { data: family, error: familyError } = await supabase
    .from('families')
    .select('id, name, created_by, created_at, updated_at')
    .eq('id', familyId)
    .single()

  if (familyError || !family) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Family not found.' } },
      { status: 404 }
    )
  }

  const { data: memberRows, error: memberError } = await supabase
    .from('family_members')
    .select('id, user_id, role, invited_email, invite_token, invited_by, accepted_at, created_at')
    .eq('family_id', familyId)
    .order('created_at', { ascending: true })

  if (memberError) {
    console.error('[v1/families/:id GET] member lookup failed', memberError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to load family members.' } },
      { status: 500 }
    )
  }

  const members = (memberRows ?? []) as Array<{
    id: string
    user_id: string | null
    role: 'admin' | 'member'
    invited_email: string
    invite_token: string | null
    invited_by: string
    accepted_at: string | null
    created_at: string
  }>

  const profileIds = new Set<string>()
  for (const member of members) {
    if (member.user_id) profileIds.add(member.user_id)
    profileIds.add(member.invited_by)
  }

  const secret = createSecretClient()
  const { data: profileRows } = profileIds.size
    ? await secret
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', Array.from(profileIds))
    : { data: [] }

  const profileMap = new Map(
    ((profileRows ?? []) as Array<{ id: string; full_name: string | null; email: string | null; avatar_url: string | null }>)
      .map((profile) => [profile.id, profile])
  )

  const enrichedMembers = members.map((member) => {
    const memberProfile = member.user_id ? profileMap.get(member.user_id) : null
    const inviterProfile = profileMap.get(member.invited_by)
    const displayName = memberProfile?.full_name || memberProfile?.email || null
    const inviterName = inviterProfile?.full_name || inviterProfile?.email || 'Someone'

    return {
      id: member.id,
      user_id: member.user_id,
      role: member.role,
      name: displayName,
      email: memberProfile?.email || member.invited_email,
      invited_email: member.invited_email,
      avatar_url: memberProfile?.avatar_url || null,
      accepted_at: member.accepted_at,
      pending: member.accepted_at === null,
      invited_by_name: inviterName,
      created_at: member.created_at,
      invite_token: member.invite_token,
    }
  })

  return NextResponse.json({
    data: {
      ...family,
      viewer_role: viewerMembership.role,
      members: enrichedMembers,
    },
  })
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: familyId } = await params
  if (!isValidUUID(familyId)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Family ID must be a valid UUID.' } },
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

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } },
      { status: 400 }
    )
  }

  const name = normalizeFamilyName(body.name)
  if (!name) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Family name is required (max 120 chars).' } },
      { status: 400 }
    )
  }

  const { data: adminMembership } = await supabase
    .from('family_members')
    .select('id')
    .eq('family_id', familyId)
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .not('accepted_at', 'is', null)
    .maybeSingle()

  if (!adminMembership) {
    return NextResponse.json(
      { error: { code: 'forbidden', message: 'Only family admins can rename this family.' } },
      { status: 403 }
    )
  }

  const { data: family, error } = await supabase
    .from('families')
    .update({ name })
    .eq('id', familyId)
    .select('id, name, created_by, created_at, updated_at')
    .single()

  if (error || !family) {
    console.error('[v1/families/:id PATCH] rename failed', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to rename family.' } },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: family })
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id: familyId } = await params
  if (!isValidUUID(familyId)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Family ID must be a valid UUID.' } },
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

  const { data: adminMembership } = await supabase
    .from('family_members')
    .select('id')
    .eq('family_id', familyId)
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .not('accepted_at', 'is', null)
    .maybeSingle()

  if (!adminMembership) {
    return NextResponse.json(
      { error: { code: 'forbidden', message: 'Only family admins can delete this family.' } },
      { status: 403 }
    )
  }

  const { error } = await supabase
    .from('families')
    .delete()
    .eq('id', familyId)

  if (error) {
    console.error('[v1/families/:id DELETE] delete failed', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to delete family.' } },
      { status: 500 }
    )
  }

  return new NextResponse(null, { status: 204 })
}
