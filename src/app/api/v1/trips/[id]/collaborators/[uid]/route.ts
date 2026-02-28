/**
 * PATCH  /api/v1/trips/:id/collaborators/:uid  — Change role (owner only)
 * DELETE /api/v1/trips/:id/collaborators/:uid  — Remove collaborator (owner only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { createUserScopedClient } from '@/lib/supabase/user-scoped'
import { isValidUUID } from '@/lib/validation'
import { dispatchWebhookEvent } from '@/lib/webhooks'

type Params = { params: Promise<{ id: string; uid: string }> }

function maskEmail(email: string): string {
  const [local, domain] = email.toLowerCase().split('@')
  if (!local || !domain) return '***'
  const head = local.slice(0, 2)
  return `${head}${'•'.repeat(Math.max(1, local.length - 2))}@${domain}`
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  const { id: tripId, uid: collabId } = await params
  if (!isValidUUID(tripId) || !isValidUUID(collabId)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Invalid trip or collaborator ID.' } },
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

  const role = typeof body.role === 'string' ? body.role : null
  if (!role || !['editor', 'viewer'].includes(role)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Role must be "editor" or "viewer".' } },
      { status: 400 }
    )
  }

  const supabase = await createUserScopedClient(auth.userId)

  // Verify ownership
  const { data: trip } = await supabase
    .from('trips')
    .select('id, user_id, title, primary_location')
    .eq('id', tripId)
    .eq('user_id', auth.userId)
    .single()

  if (!trip) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Trip not found or you are not the owner.' } },
      { status: 404 }
    )
  }

  const { data: updated, error } = await supabase
    .from('trip_collaborators')
    .update({ role })
    .eq('id', collabId)
    .eq('trip_id', tripId)
    .select('id, user_id, role, invited_email, accepted_at, created_at')
    .single()

  if (error || !updated) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Collaborator not found.' } },
      { status: 404 }
    )
  }

  return NextResponse.json({ data: updated })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  const { id: tripId, uid: collabId } = await params
  if (!isValidUUID(tripId) || !isValidUUID(collabId)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Invalid trip or collaborator ID.' } },
      { status: 400 }
    )
  }

  const supabase = await createUserScopedClient(auth.userId)

  // Verify ownership
  const { data: trip } = await supabase
    .from('trips')
    .select('id, user_id, title, primary_location')
    .eq('id', tripId)
    .eq('user_id', auth.userId)
    .single()

  if (!trip) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Trip not found or you are not the owner.' } },
      { status: 404 }
    )
  }

  const { data: collaborator } = await supabase
    .from('trip_collaborators')
    .select('id, role, invited_email, accepted_at, created_at')
    .eq('id', collabId)
    .eq('trip_id', tripId)
    .maybeSingle()

  if (!collaborator) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Collaborator not found.' } },
      { status: 404 }
    )
  }

  const { error } = await supabase
    .from('trip_collaborators')
    .delete()
    .eq('id', collabId)
    .eq('trip_id', tripId)

  if (error) {
    console.error('[v1/collaborators/:uid DELETE]', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to remove collaborator.' } },
      { status: 500 }
    )
  }

  void dispatchWebhookEvent({
    userId: trip.user_id as string,
    tripId,
    event: 'collaborator.removed',
    data: {
      trip: {
        id: trip.id,
        title: trip.title,
        primary_location: trip.primary_location,
      },
      collaborator: {
        id: collaborator.id,
        role: collaborator.role,
        invited_email_masked: maskEmail(collaborator.invited_email as string),
        accepted_at: collaborator.accepted_at,
        created_at: collaborator.created_at,
      },
    },
  }).catch((err) => console.error('[webhooks] collaborator.removed dispatch failed:', err))

  return new NextResponse(null, { status: 204 })
}
