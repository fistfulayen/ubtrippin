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
import { consumePublicRateLimit } from '@/lib/api/durable-rate-limit'

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

const MIN_PASSWORD_LENGTH = 8

function isValidPassword(value: string): boolean {
  // Basic length check — additional complexity requirements can be added here
  return value.length >= MIN_PASSWORD_LENGTH
}

export async function POST(request: NextRequest) {
  if (!await consumePublicRateLimit(request, 'invite-registration', 10, 3600)) {
    return NextResponse.json(
      { error: { code: 'rate_limited', message: 'Too many registration attempts.' } },
      { status: 429 }
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
  if (!/^[A-F0-9]{32}$/.test(inviteCode)) {
    return NextResponse.json(
      { error: { code: 'validation_error', message: 'invite_code is invalid.' } },
      { status: 400 }
    )
  }

  const supabase = createSecretClient()

  // 1. Atomically claim the invitation before creating an external auth user.
  const claimedAt = new Date().toISOString()
  const { data: invite, error: inviteError } = await supabase
    .from('invites')
    .update({ used_at: claimedAt, email_used: email })
    .eq('code', inviteCode)
    .is('used_at', null)
    .gt('expires_at', claimedAt)
    .select('id, inviter_id')
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
      { error: { code: 'invalid_invite', message: 'Invite code is invalid or unavailable.' } },
      { status: 400 }
    )
  }

  const releaseInvite = async () => {
    await supabase
      .from('invites')
      .update({ used_at: null, email_used: null })
      .eq('id', invite.id)
      .eq('used_at', claimedAt)
      .is('invitee_id', null)
  }

  // 2. Create auth user — service role is required here to create auth users
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (authError || !authData.user) {
    await releaseInvite()
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
        admitted_at: claimedAt,
      },
      { onConflict: 'id' }
    )

  if (profileError) {
    console.error('[register] profile upsert error:', profileError.message)
    await supabase.auth.admin.deleteUser(userId)
    await releaseInvite()
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to create account profile.' } },
      { status: 500 }
    )
  }

  // 4. Finalize only the claim made by this request.
  const { data: finalizedInvite, error: updateError } = await supabase
    .from('invites')
    .update({
      invitee_id: userId,
    })
    .eq('id', invite.id)
    .eq('used_at', claimedAt)
    .eq('email_used', email)
    .is('invitee_id', null)
    .select('id')
    .maybeSingle()

  if (updateError || !finalizedInvite) {
    console.error('[register] invite update error:', updateError?.message ?? 'claim was lost')
    await supabase.auth.admin.deleteUser(userId)
    await releaseInvite()
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to consume invitation.' } },
      { status: 500 }
    )
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
