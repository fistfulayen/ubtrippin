import { NextRequest, NextResponse } from 'next/server'
import { createSecretClient } from '@/lib/supabase/service'
import { decryptLoyaltyNumber } from '@/lib/loyalty-crypto'
import { resolveProviderKey } from '@/lib/loyalty-matching'
import { requireFamilyAccess } from '../../_lib'

type Params = { params: Promise<{ id: string }> }

interface ProviderCatalogRow {
  provider_key: string
  alliance_group: string | null
}

interface ProfileRow {
  id: string
  full_name: string | null
  email: string | null
}

interface LoyaltyProgramRow {
  id: string
  user_id: string
  traveler_name: string
  provider_name: string
  provider_key: string
  provider_type: string
  program_number_encrypted: string
  program_number_masked: string
  status_tier: string | null
  preferred: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export async function GET(request: NextRequest, { params }: Params) {
  const { id: familyId } = await params
  const access = await requireFamilyAccess(familyId)
  if ('response' in access) return access.response

  const providerQuery = request.nextUrl.searchParams.get('provider')?.trim() ?? ''
  if (!providerQuery) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Query param "provider" is required.', field: 'provider' } },
      { status: 400 }
    )
  }

  const providerKey = resolveProviderKey(providerQuery)
  if (!providerKey) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Could not resolve provider.', field: 'provider' } },
      { status: 400 }
    )
  }

  const { data: resolvedProvider } = await access.ctx.supabase
    .from('provider_catalog')
    .select('provider_key, alliance_group')
    .eq('provider_key', providerKey)
    .maybeSingle()

  const alliance = (resolvedProvider as ProviderCatalogRow | null)?.alliance_group ?? null
  let searchProviderKeys = [providerKey]

  if (alliance && alliance !== 'none') {
    const { data: allianceProviders } = await access.ctx.supabase
      .from('provider_catalog')
      .select('provider_key')
      .eq('alliance_group', alliance)

    const allianceKeys = (allianceProviders ?? [])
      .map((row) => (row as { provider_key?: string }).provider_key)
      .filter((value): value is string => typeof value === 'string' && value.length > 0)

    if (allianceKeys.length > 0) {
      searchProviderKeys = Array.from(new Set(allianceKeys))
    }
  }

  const memberUserIds = Array.from(new Set(access.ctx.members.map((member) => member.user_id)))
  const { data: loyaltyRows, error: loyaltyError } = await access.ctx.supabase
    .from('loyalty_programs')
    .select('id, user_id, traveler_name, provider_name, provider_key, provider_type, program_number_encrypted, program_number_masked, status_tier, preferred, notes, created_at, updated_at')
    .in('user_id', memberUserIds)
    .in('provider_key', searchProviderKeys)
    .order('preferred', { ascending: false })
    .order('updated_at', { ascending: false })

  if (loyaltyError) {
    console.error('[v1/families/:id/loyalty/lookup GET] loyalty lookup failed', loyaltyError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to lookup loyalty programs.' } },
      { status: 500 }
    )
  }

  const byUserId = new Map<string, LoyaltyProgramRow[]>()
  for (const row of (loyaltyRows ?? []) as LoyaltyProgramRow[]) {
    const existing = byUserId.get(row.user_id)
    if (existing) {
      existing.push(row)
    } else {
      byUserId.set(row.user_id, [row])
    }
  }

  const secret = createSecretClient()
  const { data: profileRows } = memberUserIds.length
    ? await secret
        .from('profiles')
        .select('id, full_name, email')
        .in('id', memberUserIds)
    : { data: [] }

  const nameByUserId = new Map<string, string | null>(
    ((profileRows ?? []) as ProfileRow[]).map((row) => [row.id, row.full_name || row.email || null])
  )

  const data = memberUserIds.map((memberUserId) => {
    const rows = byUserId.get(memberUserId) ?? []
    const exact = rows.find((row) => row.provider_key === providerKey) ?? null
    const selected = exact ?? rows[0] ?? null

    return {
      user_id: memberUserId,
      member_name: nameByUserId.get(memberUserId) ?? null,
      exact_match: !!exact,
      program: selected
        ? {
            id: selected.id,
            user_id: selected.user_id,
            traveler_name: selected.traveler_name,
            provider_name: selected.provider_name,
            provider_key: selected.provider_key,
            provider_type: selected.provider_type,
            program_number: decryptLoyaltyNumber(selected.program_number_encrypted),
            program_number_masked: selected.program_number_masked,
            status_tier: selected.status_tier,
            preferred: selected.preferred,
            notes: selected.notes,
            created_at: selected.created_at,
            updated_at: selected.updated_at,
          }
        : null,
    }
  })

  const matchedCount = data.filter((row) => !!row.program).length

  return NextResponse.json({
    data,
    meta: {
      provider_key: providerKey,
      alliance: alliance && alliance !== 'none' ? alliance : null,
      family_member_count: memberUserIds.length,
      matched_count: matchedCount,
    },
  })
}
