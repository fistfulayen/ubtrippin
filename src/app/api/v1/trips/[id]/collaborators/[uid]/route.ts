/**
 * PATCH  /api/v1/trips/:id/collaborators/:uid  — Change role (owner only)
 * DELETE /api/v1/trips/:id/collaborators/:uid  — Remove collaborator (owner only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { createSecretClient } from '@/lib/supabase/server'
import { isValidUUID } from '@/lib/validation'

type Params = { params: Promise<{ id: string; uid: string }> }

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

  const supabase = createSecretClient()

  // Verify ownership
  const { data: trip } = await supabase
    .from('trips')
    .select('id')
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

  const supabase = createSecretClient()

  // Verify ownership
  const { data: trip } = await supabase
    .from('trips')
    .select('id')
    .eq('id', tripId)
    .eq('user_id', auth.userId)
    .single()

  if (!trip) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Trip not found or you are not the owner.' } },
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

  return new NextResponse(null, { status: 204 })
}
