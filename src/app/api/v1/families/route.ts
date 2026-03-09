import { NextRequest, NextResponse } from 'next/server'
import { requireSessionAuth, isSessionAuthError } from '@/lib/api/session-auth'
import { createSecretClient } from '@/lib/supabase/service'

function normalizeFamilyName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 120) return null
  return trimmed
}

export async function GET() {
  const auth = await requireSessionAuth()
  if (isSessionAuthError(auth)) return auth

  // Use SECURITY DEFINER RPC to avoid RLS circular dependency on families ↔ family_members
  const { data: families, error } = await auth.supabase.rpc('get_my_families')

  if (error) {
    console.error('[v1/families GET] get_my_families RPC failed', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to load families.' } },
      { status: 500 }
    )
  }

  const data = (families ?? []).map((row: {
    id: string
    name: string
    created_by: string
    role: string
    member_count: number
    created_at: string
    updated_at: string
  }) => ({
    id: row.id,
    name: row.name,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    role: row.role,
    member_count: Number(row.member_count),
  }))

  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const auth = await requireSessionAuth()
  if (isSessionAuthError(auth)) return auth

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } },
      { status: 400 }
    )
  }

  const name = normalizeFamilyName(body.name)
  if (!name) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Family name is required (max 120 chars).' } },
      { status: 400 }
    )
  }

  const { data: profileData } = await auth.supabase
    .from('profiles')
    .select('subscription_tier, email')
    .eq('id', auth.userId)
    .maybeSingle()

  const profile = profileData as { subscription_tier?: string | null; email?: string | null } | null
  if (profile?.subscription_tier !== 'pro') {
    return NextResponse.json(
      {
        error: {
          code: 'forbidden',
          message: 'Family sharing is a Pro feature. Upgrade to Pro to create a family.',
        },
      },
      { status: 403 }
    )
  }

  const { data: family, error: familyError } = await auth.supabase
    .from('families')
    .insert({
      name,
      created_by: auth.userId,
    })
    .select('id, name, created_by, created_at, updated_at')
    .single()

  if (familyError || !family) {
    console.error('[v1/families POST] create failed', familyError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to create family.' } },
      { status: 500 }
    )
  }

  const invitedEmail = (profile?.email || '').trim().toLowerCase()
  if (!invitedEmail) {
    const secret = createSecretClient()
    await secret.from('families').delete().eq('id', family.id)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Could not determine your account email.' } },
      { status: 500 }
    )
  }

  // RLS allows this because the policy includes: invited_by = auth.uid()
  const { error: memberError } = await auth.supabase
    .from('family_members')
    .insert({
      family_id: family.id,
      user_id: auth.userId,
      role: 'admin',
      invited_email: invitedEmail,
      invited_by: auth.userId,
      accepted_at: new Date().toISOString(),
      invite_token: null,
    })

  if (memberError) {
    console.error('[v1/families POST] bootstrap member failed', memberError)
    const secret = createSecretClient()
    await secret.from('families').delete().eq('id', family.id)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to create family membership.' } },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: family }, { status: 201 })
}
