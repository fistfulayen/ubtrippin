import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { createClient } from '@/lib/supabase/server'
import { isValidUUID } from '@/lib/validation'
import { sendFamilyInviteEmail } from '@/lib/email/family-invite'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://ubtrippin.xyz'

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
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

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email || !isValidEmail(email)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'A valid email address is required.' } },
      { status: 400 }
    )
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('subscription_tier, full_name, email')
    .eq('id', user.id)
    .maybeSingle()

  const inviterProfile = profileData as {
    subscription_tier?: string | null
    full_name?: string | null
    email?: string | null
  } | null

  if (inviterProfile?.subscription_tier !== 'pro') {
    return NextResponse.json(
      {
        error: {
          code: 'forbidden',
          message: 'Family sharing is a Pro feature. Upgrade to Pro to invite family members.',
        },
      },
      { status: 403 }
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
      { error: { code: 'forbidden', message: 'Only family admins can invite members.' } },
      { status: 403 }
    )
  }

  const { data: family } = await supabase
    .from('families')
    .select('id, name')
    .eq('id', familyId)
    .maybeSingle()

  if (!family) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Family not found.' } },
      { status: 404 }
    )
  }

  const { data: existingInvite } = await supabase
    .from('family_members')
    .select('id, accepted_at')
    .eq('family_id', familyId)
    .eq('invited_email', email)
    .maybeSingle()

  if (existingInvite) {
    const message = existingInvite.accepted_at
      ? 'This person is already a member of the family.'
      : 'An invite is already pending for this email address.'

    return NextResponse.json(
      { error: { code: 'conflict', message } },
      { status: 409 }
    )
  }

  const inviteToken = nanoid()

  const { data: pendingMember, error: insertError } = await supabase
    .from('family_members')
    .insert({
      family_id: familyId,
      invited_email: email,
      invited_by: user.id,
      role: 'member',
      invite_token: inviteToken,
    })
    .select('id, family_id, user_id, role, invited_email, accepted_at, created_at')
    .single()

  if (insertError || !pendingMember) {
    console.error('[v1/families/:id/members POST] invite insert failed', insertError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to create family invite.' } },
      { status: 500 }
    )
  }

  const inviterName = inviterProfile?.full_name || inviterProfile?.email || user.email || 'Someone'
  const inviteUrl = `${APP_URL}/invite/family/${inviteToken}`

  await sendFamilyInviteEmail({
    to: email,
    inviterName,
    familyName: family.name as string,
    inviteUrl,
  }).catch((err: Error) => {
    console.error('[family invite email] send failed', err)
  })

  return NextResponse.json({ data: pendingMember }, { status: 201 })
}
