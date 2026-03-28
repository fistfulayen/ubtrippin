/**
 * POST /api/v1/auth/register — Register a new account using an invite code
 *
 * Body: { email, password, full_name, invite_code }
 *
 * Flow:
 *  1. Validate invite exists, not expired, not used
 *  2. Create Supabase auth user (service role — only acceptable use here)
 *  3. Insert profile row
 *  4. Mark invite used
 *  5. Notify inviter by email (fire-and-forget)
 *
 * Returns: { user_id, message: "Account created" }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSecretClient } from '@/lib/supabase/service'
import { sendInviteJoinedEmail } from '@/lib/email/invite-joined'

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

const MIN_PASSWORD_LENGTH = 8

function isValidPassword(value: string): boolean {
  // Basic length check — additional complexity requirements can be added here
  return value.length >= MIN_PASSWORD_LENGTH
}

export async function POST(request: NextRequest) {
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
  const password = typeof body.password === 'string' ? body.password : ''
  const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : ''
  const inviteCode = typeof body.invite_code === 'string' ? body.invite_code.trim().toUpperCase() : ''

  if (!email || !isValidEmail(email)) {
    return NextResponse.json(
      { error: { code: 'validation_error', message: 'A valid email is required.' } },
      { status: 400 }
    )
  }
  if (!password || !isValidPassword(password)) {
    return NextResponse.json(
      { error: { code: 'validation_error', message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` } },
      { status: 400 }
    )
  }
  if (!fullName) {
    return NextResponse.json(
      { error: { code: 'validation_error', message: 'full_name is required.' } },
      { status: 400 }
    )
  }
  if (!inviteCode) {
    return NextResponse.json(
      { error: { code: 'validation_error', message: 'invite_code is required.' } },
      { status: 400 }
    )
  }

  const supabase = createSecretClient()

  // 1. Validate invite
  const { data: invite, error: inviteError } = await supabase
    .from('invites')
    .select('id, inviter_id, used_at, expires_at')
    .eq('code', inviteCode)
    .maybeSingle()

  if (inviteError) {
    console.error('[register] invite lookup error:', inviteError.message)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Could not validate invite.' } },
      { status: 500 }
    )
  }

  if (!invite) {
    return NextResponse.json(
      { error: { code: 'invalid_invite', message: 'Invite code not found.' } },
      { status: 400 }
    )
  }

  if (invite.used_at) {
    return NextResponse.json(
      { error: { code: 'invalid_invite', message: 'This invite has already been used.' } },
      { status: 400 }
    )
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json(
      { error: { code: 'invalid_invite', message: 'This invite has expired.' } },
      { status: 400 }
    )
  }

  // 2. Create auth user — service role is required here to create auth users
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (authError || !authData.user) {
    // Check for specific Supabase error codes first, then fall back to message matching
    const errorCode = (authError as { code?: string })?.code
    const msg = authError?.message ?? 'Unknown error'
    
    // Surface email-already-exists without leaking internal detail
    // Supabase auth error codes: https://supabase.com/docs/reference/javascript/auth-error-codes
    if (errorCode === 'user_already_exists' || 
        msg.toLowerCase().includes('already registered') || 
        msg.toLowerCase().includes('already exists')) {
      return NextResponse.json(
        { error: { code: 'email_taken', message: 'An account with this email already exists.' } },
        { status: 409 }
      )
    }
    console.error('[register] createUser error:', msg)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to create account.' } },
      { status: 500 }
    )
  }

  const userId = authData.user.id

  // 3. Insert profile (the DB trigger may also create one, but we upsert to be safe)
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        email,
        full_name: fullName,
      },
      { onConflict: 'id' }
    )

  if (profileError) {
    console.error('[register] profile upsert error:', profileError.message)
    // Log for monitoring but don't fail — profile may have been created by DB trigger
    // If both upsert AND trigger failed, user will see incomplete profile on first login
    // which they can fix by updating their profile settings
  }

  // 4. Mark invite used — service role bypasses RLS update restriction
  const { error: updateError } = await supabase
    .from('invites')
    .update({
      used_at: new Date().toISOString(),
      email_used: email,
      invitee_id: userId,
    })
    .eq('id', invite.id)

  if (updateError) {
    console.error('[register] invite update error:', updateError.message)
    // Non-fatal: account was created; invite tracking failure is acceptable
  }

  // 5. Notify inviter — fire-and-forget, no await
  void Promise.resolve(
    supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', invite.inviter_id)
      .single()
      .then(({ data: inviter }) => {
        if (!inviter?.email) return
        void Promise.resolve(sendInviteJoinedEmail({
          to: inviter.email,
          inviterName: inviter.full_name?.split(' ')[0] ?? 'there',
          inviteeName: fullName,
        })).catch((err: unknown) => console.error('[register] invite notification email failed:', err))
      })
  ).catch((err: unknown) => console.error('[register] inviter lookup failed:', err))

  return NextResponse.json({ user_id: userId, message: 'Account created' }, { status: 201 })
}
