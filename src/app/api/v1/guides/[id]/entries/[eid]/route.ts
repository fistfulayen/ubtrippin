/**
 * PATCH  /api/v1/guides/:id/entries/:eid  — Update an entry
 * DELETE /api/v1/guides/:id/entries/:eid  — Remove an entry
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { createSecretClient } from '@/lib/supabase/server'
import { isValidUUID } from '@/lib/validation'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; eid: string }> }
) {
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  const { id: guideId, eid: entryId } = await params
  if (!isValidUUID(guideId) || !isValidUUID(entryId)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'IDs must be valid UUIDs.' } },
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

  const supabase = createSecretClient()

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.category !== undefined) updates.category = body.category
  if (body.status !== undefined) updates.status = body.status === 'to_try' ? 'to_try' : 'visited'
  if (body.description !== undefined) updates.description = body.description
  if (body.address !== undefined) updates.address = body.address
  if (body.website_url !== undefined) updates.website_url = body.website_url
  if (body.latitude !== undefined) updates.latitude = body.latitude ? Number(body.latitude) : null
  if (body.longitude !== undefined) updates.longitude = body.longitude ? Number(body.longitude) : null
  if (body.rating !== undefined) updates.rating = body.rating ? Number(body.rating) : null
  if (body.recommended_by !== undefined) updates.recommended_by = body.recommended_by
  if (body.tags !== undefined) updates.tags = body.tags

  const { data: entry, error } = await supabase
    .from('guide_entries')
    .update(updates)
    .eq('id', entryId)
    .eq('guide_id', guideId)
    .eq('user_id', auth.userId)
    .select('*')
    .single()

  if (error || !entry) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Entry not found.' } },
      { status: 404 }
    )
  }

  return NextResponse.json({ data: entry })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; eid: string }> }
) {
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  const { id: guideId, eid: entryId } = await params
  if (!isValidUUID(guideId) || !isValidUUID(entryId)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'IDs must be valid UUIDs.' } },
      { status: 400 }
    )
  }

  const supabase = createSecretClient()

  const { error } = await supabase
    .from('guide_entries')
    .delete()
    .eq('id', entryId)
    .eq('guide_id', guideId)
    .eq('user_id', auth.userId)

  if (error) {
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to delete entry.' } },
      { status: 500 }
    )
  }

  return new NextResponse(null, { status: 204 })
}
