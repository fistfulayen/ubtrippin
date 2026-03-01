import { NextRequest, NextResponse } from 'next/server'
import { requireSessionAuth, isSessionAuthError } from '@/lib/api/session-auth'
import { decryptLoyaltyNumber } from '@/lib/loyalty-crypto'
import { resolveProviderKey } from '@/lib/loyalty-matching'

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

interface ProviderCatalogRow {
  provider_key: string
  provider_name: string
  provider_type: string
  alliance_group: string | null
}

function asProgram(row: LoyaltyProgramRow, alliance: string | null) {
  return {
    id: row.id,
    user_id: row.user_id,
    traveler_name: row.traveler_name,
    provider_type: row.provider_type,
    provider_name: row.provider_name,
    provider_key: row.provider_key,
    program_number: decryptLoyaltyNumber(row.program_number_encrypted),
    program_number_masked: row.program_number_masked,
    status_tier: row.status_tier,
    preferred: row.preferred,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    alliance_group: alliance,
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireSessionAuth()
  if (isSessionAuthError(auth)) return auth

  const provider = request.nextUrl.searchParams.get('provider')
  if (!provider?.trim()) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Query param "provider" is required.', field: 'provider' } },
      { status: 400 }
    )
  }

  const resolvedProviderKey = resolveProviderKey(provider)
  if (!resolvedProviderKey) {
    return NextResponse.json({ exact_match: false })
  }

  
  // Step 1: exact provider match
  const { data: exactProgram } = await auth.supabase
    .from('loyalty_programs')
    .select('*')
    .eq('user_id', auth.userId)
    .eq('provider_key', resolvedProviderKey)
    .order('preferred', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: providerRow } = await auth.supabase
    .from('provider_catalog')
    .select('provider_key, provider_name, provider_type, alliance_group')
    .eq('provider_key', resolvedProviderKey)
    .maybeSingle()

  const allianceGroup = (providerRow as ProviderCatalogRow | null)?.alliance_group ?? null

  if (exactProgram) {
    return NextResponse.json({
      exact_match: true,
      program: asProgram(exactProgram as LoyaltyProgramRow, allianceGroup),
    })
  }

  // Step 2: compatible alliance fallback
  if (!allianceGroup || allianceGroup === 'none') {
    return NextResponse.json({ exact_match: false })
  }

  const { data: allianceProviders } = await auth.supabase
    .from('provider_catalog')
    .select('provider_key')
    .eq('alliance_group', allianceGroup)

  const providerKeys = (allianceProviders ?? [])
    .map((row) => (row as { provider_key?: string }).provider_key)
    .filter((key): key is string => typeof key === 'string' && key.length > 0)

  if (providerKeys.length === 0) {
    return NextResponse.json({ exact_match: false })
  }

  const { data: compatible } = await auth.supabase
    .from('loyalty_programs')
    .select('*')
    .eq('user_id', auth.userId)
    .in('provider_key', providerKeys)
    .order('preferred', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!compatible) {
    return NextResponse.json({ exact_match: false })
  }

  return NextResponse.json({
    exact_match: false,
    compatible_program: asProgram(compatible as LoyaltyProgramRow, allianceGroup),
    alliance: allianceGroup,
  })
}
