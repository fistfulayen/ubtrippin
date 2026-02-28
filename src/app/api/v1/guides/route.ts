/**
 * GET  /api/v1/guides  — List all city guides for the authenticated user
 * POST /api/v1/guides  — Create a new city guide
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { createUserScopedClient } from '@/lib/supabase/user-scoped'
import { nanoid } from 'nanoid'

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  const { searchParams } = new URL(request.url)
  const city = searchParams.get('city')

  const supabase = await createUserScopedClient(auth.userId)

  let query = supabase
    .from('city_guides')
    .select('*')
    .eq('user_id', auth.userId)
    .order('updated_at', { ascending: false })

  if (city) {
    query = query.ilike('city', `%${city}%`)
  }

  const { data: guides, error } = await query

  if (error) {
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch guides.' } },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: guides ?? [], meta: { count: (guides ?? []).length } })
}

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } },
      { status: 400 }
    )
  }

  const city = (body.city as string)?.trim()
  if (!city) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: '"city" is required.' } },
      { status: 400 }
    )
  }

  const supabase = await createUserScopedClient(auth.userId)

  // If caller passes find_or_create=true, return existing guide for this city
  if (body.find_or_create) {
    const { data: existing } = await supabase
      .from('city_guides')
      .select('*')
      .eq('user_id', auth.userId)
      .ilike('city', city)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ data: existing }, { status: 200 })
    }
  }

  const { data: guide, error } = await supabase
    .from('city_guides')
    .insert({
      user_id: auth.userId,
      city,
      country: (body.country as string) ?? null,
      country_code: (body.country_code as string) ?? null,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to create guide.' } },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: guide }, { status: 201 })
}
