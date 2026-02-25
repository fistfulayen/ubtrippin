/**
 * GET  /api/v1/trips/:id/collaborators  — List collaborators (owner only)
 * POST /api/v1/trips/:id/collaborators  — Invite a collaborator (owner only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { createSecretClient } from '@/lib/supabase/service'
import { isValidUUID } from '@/lib/validation'
import { sendCollaboratorInviteEmail } from '@/lib/email/collaborator-invite'
import { customAlphabet } from 'nanoid'

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 32)

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  const { id: tripId } = await params
  if (!isValidUUID(tripId)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Trip ID must be a valid UUID.' } },
      { status: 400 }
    )
  }

  const supabase = createSecretClient()

  // Verify ownership
  const { data: trip } = await supabase
    .from('trips')
    .select('id, title, primary_location')
    .eq('id', tripId)
    .eq('user_id', auth.userId)
    .single()

  if (!trip) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Trip not found or you are not the owner.' } },
      { status: 404 }
    )
  }

  const { data: collaborators, error } = await supabase
    .from('trip_collaborators')
    .select('id, user_id, role, invited_email, accepted_at, created_at')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[v1/collaborators GET]', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch collaborators.' } },
      { status: 500 }
    )
  }

  return NextResponse.json({
    data: collaborators ?? [],
    meta: { count: (collaborators ?? []).length },
  })
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  const { id: tripId } = await params
  if (!isValidUUID(tripId)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Trip ID must be a valid UUID.' } },
      { status: 400 }
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
  const role = typeof body.role === 'string' ? body.role : 'editor'

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'A valid email address is required.' } },
      { status: 400 }
    )
  }

  if (!['editor', 'viewer'].includes(role)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Role must be "editor" or "viewer".' } },
      { status: 400 }
    )
  }

  const supabase = createSecretClient()

  // Verify ownership + get trip details for email
  const { data: trip } = await supabase
    .from('trips')
    .select('id, title, primary_location, user_id')
    .eq('id', tripId)
    .eq('user_id', auth.userId)
    .single()

  if (!trip) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Trip not found or you are not the owner.' } },
      { status: 404 }
    )
  }

  // Get inviter's profile
  const { data: inviterProfile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', auth.userId)
    .single()

  // Check for duplicate invite
  const { data: existing } = await supabase
    .from('trip_collaborators')
    .select('id, accepted_at')
    .eq('trip_id', tripId)
    .eq('invited_email', email)
    .maybeSingle()

  if (existing) {
    const msg = existing.accepted_at
      ? 'This person is already a collaborator on this trip.'
      : 'An invite has already been sent to this email.'
    return NextResponse.json(
      { error: { code: 'conflict', message: msg } },
      { status: 409 }
    )
  }

  // Generate invite token
  const inviteToken = nanoid()

  const { data: collab, error } = await supabase
    .from('trip_collaborators')
    .insert({
      trip_id: tripId,
      role,
      invited_email: email,
      invited_by: auth.userId,
      invite_token: inviteToken,
    })
    .select('id, user_id, role, invited_email, accepted_at, created_at')
    .single()

  if (error || !collab) {
    console.error('[v1/collaborators POST]', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to create invite.' } },
      { status: 500 }
    )
  }

  // Send invite email (non-blocking — don't fail the request if email fails)
  const inviterName = inviterProfile?.full_name || inviterProfile?.email || 'Someone'
  const tripLabel = trip.primary_location || trip.title
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ubtrippin.com'
  const inviteUrl = `${appUrl}/invite/${inviteToken}`

  await sendCollaboratorInviteEmail({
    to: email,
    inviterName,
    tripLabel,
    inviteUrl,
  }).catch((err: Error) => console.error('[invite email]', err))

  return NextResponse.json({ data: collab }, { status: 201 })
}
