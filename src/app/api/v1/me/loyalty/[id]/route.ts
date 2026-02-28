import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSessionAuth, isSessionAuthError } from '@/lib/api/session-auth'
import { decryptLoyaltyNumber, encryptLoyaltyNumber, maskLoyaltyNumber } from '@/lib/loyalty-crypto'
import { isValidUUID } from '@/lib/validation'

interface LoyaltyProgramRow {
  id: string
  user_id: string
  traveler_name: string
  provider_type: string
  provider_name: string
  provider_key: string
  program_number_encrypted: string
  program_number_masked: string
  status_tier: string | null
  preferred: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

function parseNullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function toResponse(row: LoyaltyProgramRow) {
  return {
    id: row.id,
    user_id: row.user_id,
    traveler_name: row.traveler_name,
    provider_type: row.provider_type,
    provider_name: row.provider_name,
    provider_key: row.provider_key,
    program_number_masked: row.program_number_masked,
    program_number: decryptLoyaltyNumber(row.program_number_encrypted),
    status_tier: row.status_tier,
    preferred: row.preferred,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSessionAuth()
  if (isSessionAuthError(auth)) return auth

  const { id } = await params
  if (!isValidUUID(id)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'id must be a valid UUID.', field: 'id' } },
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

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('loyalty_programs')
    .select('*')
    .eq('id', id)
    .eq('user_id', auth.userId)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Loyalty program not found.' } },
      { status: 404 }
    )
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (body.traveler_name !== undefined) {
    if (typeof body.traveler_name !== 'string' || !body.traveler_name.trim()) {
      return NextResponse.json(
        { error: { code: 'invalid_param', message: 'traveler_name must be a non-empty string.', field: 'traveler_name' } },
        { status: 400 }
      )
    }
    updates.traveler_name = body.traveler_name.trim()
  }

  if (body.status_tier !== undefined) {
    const statusTier = parseNullableString(body.status_tier)
    if (statusTier === undefined) {
      return NextResponse.json(
        { error: { code: 'invalid_param', message: 'status_tier must be a string or null.', field: 'status_tier' } },
        { status: 400 }
      )
    }
    updates.status_tier = statusTier
  }

  if (body.notes !== undefined) {
    const notes = parseNullableString(body.notes)
    if (notes === undefined) {
      return NextResponse.json(
        { error: { code: 'invalid_param', message: 'notes must be a string or null.', field: 'notes' } },
        { status: 400 }
      )
    }
    updates.notes = notes
  }

  if (body.preferred !== undefined) {
    if (typeof body.preferred !== 'boolean') {
      return NextResponse.json(
        { error: { code: 'invalid_param', message: 'preferred must be a boolean.', field: 'preferred' } },
        { status: 400 }
      )
    }
    updates.preferred = body.preferred
  }

  if (body.program_number !== undefined) {
    if (typeof body.program_number !== 'string' || !body.program_number.trim()) {
      return NextResponse.json(
        { error: { code: 'invalid_param', message: 'program_number must be a non-empty string.', field: 'program_number' } },
        { status: 400 }
      )
    }

    const programNumber = body.program_number.trim()
    updates.program_number_encrypted = encryptLoyaltyNumber(programNumber)
    updates.program_number_masked = maskLoyaltyNumber(programNumber)
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'No updatable fields were provided.' } },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('loyalty_programs')
    .update(updates)
    .eq('id', id)
    .eq('user_id', auth.userId)
    .select('*')
    .single()

  if (error || !data) {
    console.error('[v1/me/loyalty/:id PATCH] Supabase error:', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to update loyalty program.' } },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: toResponse(data as LoyaltyProgramRow) })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSessionAuth()
  if (isSessionAuthError(auth)) return auth

  const { id } = await params
  if (!isValidUUID(id)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'id must be a valid UUID.', field: 'id' } },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('loyalty_programs')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.userId)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[v1/me/loyalty/:id DELETE] Supabase error:', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to delete loyalty program.' } },
      { status: 500 }
    )
  }

  if (!data) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Loyalty program not found.' } },
      { status: 404 }
    )
  }

  return new NextResponse(null, { status: 204 })
}
