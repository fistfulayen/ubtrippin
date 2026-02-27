import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSecretClient } from '@/lib/supabase/service'

function normalizeFamilyName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 120) return null
  return trimmed
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Authentication required.' } },
      { status: 401 }
    )
  }

  const { data: memberships, error } = await supabase
    .from('family_members')
    .select('family_id, role, family:families(id, name, created_by, created_at, updated_at)')
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)

  if (error) {
    console.error('[v1/families GET] membership lookup failed', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to load families.' } },
      { status: 500 }
    )
  }

  const rows = (memberships ?? []) as Array<{
    family_id: string
    role: 'admin' | 'member'
    family: Array<{
      id: string
      name: string
      created_by: string
      created_at: string
      updated_at: string
    }> | null
  }>

  const familyIds = rows.map((row) => row.family_id)
  const memberCountMap = new Map<string, number>()

  if (familyIds.length > 0) {
    const { data: memberRows, error: countError } = await supabase
      .from('family_members')
      .select('family_id')
      .in('family_id', familyIds)
      .not('accepted_at', 'is', null)

    if (countError) {
      console.error('[v1/families GET] member count lookup failed', countError)
      return NextResponse.json(
        { error: { code: 'internal_error', message: 'Failed to load families.' } },
        { status: 500 }
      )
    }

    for (const row of memberRows ?? []) {
      const count = memberCountMap.get(row.family_id as string) ?? 0
      memberCountMap.set(row.family_id as string, count + 1)
    }
  }

  const data = rows
    .map((row) => {
      const family = Array.isArray(row.family) ? row.family[0] : null
      if (!family) return null
      return {
        id: family.id,
        name: family.name,
        created_by: family.created_by,
        created_at: family.created_at,
        updated_at: family.updated_at,
        role: row.role,
        member_count: memberCountMap.get(row.family_id) ?? 0,
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Authentication required.' } },
      { status: 401 }
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

  const name = normalizeFamilyName(body.name)
  if (!name) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Family name is required (max 120 chars).' } },
      { status: 400 }
    )
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('subscription_tier, email')
    .eq('id', user.id)
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

  const { data: family, error: familyError } = await supabase
    .from('families')
    .insert({
      name,
      created_by: user.id,
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

  const invitedEmail = (user.email || profile?.email || '').trim().toLowerCase()
  if (!invitedEmail) {
    const secret = createSecretClient()
    await secret.from('families').delete().eq('id', family.id)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Could not determine your account email.' } },
      { status: 500 }
    )
  }

  // RLS allows this because the policy includes: invited_by = auth.uid()
  const { error: memberError } = await supabase
    .from('family_members')
    .insert({
      family_id: family.id,
      user_id: user.id,
      role: 'admin',
      invited_email: invitedEmail,
      invited_by: user.id,
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
