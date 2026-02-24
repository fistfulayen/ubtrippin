/**
 * POST /api/v1/guides/:id/entries  — Add an entry to a guide
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { createSecretClient } from '@/lib/supabase/server'
import { isValidUUID } from '@/lib/validation'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  const { id: guideId } = await params
  if (!isValidUUID(guideId)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Guide ID must be a valid UUID.' } },
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

  const name = (body.name as string)?.trim()
  if (!name) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: '"name" is required.' } },
      { status: 400 }
    )
  }

  const supabase = createSecretClient()

  // Verify guide ownership
  const { data: guide } = await supabase
    .from('city_guides')
    .select('id')
    .eq('id', guideId)
    .eq('user_id', auth.userId)
    .single()

  if (!guide) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Guide not found.' } },
      { status: 404 }
    )
  }

  const status = body.status === 'to_try' ? 'to_try' : 'visited'
  const source = (['manual', 'agent', 'import', 'share-to'] as const).includes(
    body.source as 'manual' | 'agent' | 'import' | 'share-to'
  )
    ? (body.source as 'manual' | 'agent' | 'import' | 'share-to')
    : 'agent'

  const rating = body.rating ? Number(body.rating) : null

  const { data: entry, error } = await supabase
    .from('guide_entries')
    .insert({
      guide_id: guideId,
      user_id: auth.userId,
      name,
      category: (body.category as string) ?? 'Hidden Gems',
      status,
      description: (body.description as string) ?? null,
      address: (body.address as string) ?? null,
      website_url: (body.website_url as string) ?? null,
      latitude: body.latitude ? Number(body.latitude) : null,
      longitude: body.longitude ? Number(body.longitude) : null,
      google_place_id: (body.google_place_id as string) ?? null,
      rating: rating && !isNaN(rating) ? rating : null,
      recommended_by: (body.recommended_by as string) ?? null,
      tags: Array.isArray(body.tags) ? body.tags : [],
      source,
      source_url: (body.source_url as string) ?? null,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to create entry.' } },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: entry }, { status: 201 })
}
