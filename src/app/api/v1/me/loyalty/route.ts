import { NextRequest, NextResponse } from 'next/server'
import { requireSessionAuth, isSessionAuthError } from '@/lib/api/session-auth'
import type { SupabaseClient } from '@supabase/supabase-js'
import { decryptLoyaltyNumber, encryptLoyaltyNumber, maskLoyaltyNumber } from '@/lib/loyalty-crypto'

const PROVIDER_TYPES = ['airline', 'hotel', 'car_rental', 'other'] as const

type ProviderType = (typeof PROVIDER_TYPES)[number]

interface LoyaltyProgramRow {
  id: string
  user_id: string
  traveler_name: string
  provider_type: ProviderType
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

interface ProviderCatalogRow {
  provider_key: string
  alliance_group: string | null
}

function parseNullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function isProviderType(value: unknown): value is ProviderType {
  return typeof value === 'string' && PROVIDER_TYPES.includes(value as ProviderType)
}

async function isProUser(
  userId: string,
  supabase: SupabaseClient
): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('tier, subscription_tier')
    .eq('id', userId)
    .maybeSingle()

  const row = data as { tier?: string | null; subscription_tier?: string | null } | null
  return row?.tier === 'pro' || row?.subscription_tier === 'pro'
}

async function getAllianceMap(
  providerKeys: string[],
  supabase: SupabaseClient
): Promise<Map<string, string | null>> {
  if (providerKeys.length === 0) return new Map()
  const { data } = await supabase
    .from('provider_catalog')
    .select('provider_key, alliance_group')
    .in('provider_key', providerKeys)

  const rows = (data ?? []) as ProviderCatalogRow[]
  return new Map(rows.map((row) => [row.provider_key, row.alliance_group]))
}

function withPlaintext(
  row: LoyaltyProgramRow,
  allianceGroup: string | null
): Omit<LoyaltyProgramRow, 'program_number_encrypted'> & { program_number: string; alliance_group: string | null } {
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
    alliance_group: allianceGroup,
  }
}

export async function GET() {
  const auth = await requireSessionAuth()
  if (isSessionAuthError(auth)) return auth

  // RLS handles visibility: own programs + family members' programs
  const { data, error } = await auth.supabase
    .from('loyalty_programs')
    .select('*')
    .order('preferred', { ascending: false })
    .order('user_id', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[v1/me/loyalty GET] Supabase error:', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch loyalty programs.' } },
      { status: 500 }
    )
  }

  const rows = (data ?? []) as LoyaltyProgramRow[]
  const allianceMap = await getAllianceMap(
    [...new Set(rows.map((row) => row.provider_key))],
    auth.supabase
  )

  const output = rows.map((row) =>
    withPlaintext(row, allianceMap.get(row.provider_key) ?? null)
  )

  return NextResponse.json({ data: output, meta: { count: output.length } })
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

  if (typeof body.traveler_name !== 'string' || !body.traveler_name.trim()) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'traveler_name is required.', field: 'traveler_name' } },
      { status: 400 }
    )
  }

  if (!isProviderType(body.provider_type)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'provider_type is invalid.', field: 'provider_type' } },
      { status: 400 }
    )
  }

  if (typeof body.provider_name !== 'string' || !body.provider_name.trim()) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'provider_name is required.', field: 'provider_name' } },
      { status: 400 }
    )
  }

  if (typeof body.provider_key !== 'string' || !body.provider_key.trim()) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'provider_key is required.', field: 'provider_key' } },
      { status: 400 }
    )
  }

  if (typeof body.program_number !== 'string' || !body.program_number.trim()) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'program_number is required.', field: 'program_number' } },
      { status: 400 }
    )
  }

  const { count } = await auth.supabase
    .from('loyalty_programs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.userId)

  const pro = await isProUser(auth.userId, auth.supabase)
  if (!pro && (count ?? 0) >= 3) {
    return NextResponse.json(
      {
        error: {
          code: 'pro_required',
          message: 'Free tier limit reached. Upgrade to Pro for unlimited loyalty programs.',
        },
      },
      { status: 403 }
    )
  }

  const programNumber = body.program_number.trim()
  const encrypted = encryptLoyaltyNumber(programNumber)
  const masked = maskLoyaltyNumber(programNumber)
  const statusTier = parseNullableString(body.status_tier)
  const notes = parseNullableString(body.notes)

  if (body.status_tier !== undefined && statusTier === undefined) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'status_tier must be a string or null.', field: 'status_tier' } },
      { status: 400 }
    )
  }

  if (body.notes !== undefined && notes === undefined) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'notes must be a string or null.', field: 'notes' } },
      { status: 400 }
    )
  }

  if (body.preferred !== undefined && typeof body.preferred !== 'boolean') {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'preferred must be a boolean.', field: 'preferred' } },
      { status: 400 }
    )
  }

  const { data, error } = await auth.supabase
    .from('loyalty_programs')
    .insert({
      user_id: auth.userId,
      traveler_name: body.traveler_name.trim(),
      provider_type: body.provider_type,
      provider_name: body.provider_name.trim(),
      provider_key: body.provider_key.trim().toLowerCase(),
      program_number_encrypted: encrypted,
      program_number_masked: masked,
      status_tier: statusTier ?? null,
      preferred: typeof body.preferred === 'boolean' ? body.preferred : false,
      notes: notes ?? null,
    })
    .select('*')
    .single()

  if (error || !data) {
    console.error('[v1/me/loyalty POST] Supabase error:', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to create loyalty program.' } },
      { status: 500 }
    )
  }

  const { data: provider } = await auth.supabase
    .from('provider_catalog')
    .select('alliance_group')
    .eq('provider_key', (data as LoyaltyProgramRow).provider_key)
    .maybeSingle()

  return NextResponse.json(
    {
      data: withPlaintext(
        data as LoyaltyProgramRow,
        (provider as { alliance_group?: string | null } | null)?.alliance_group ?? null
      ),
    },
    { status: 201 }
  )
}
