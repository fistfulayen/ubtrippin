import { decryptLoyaltyNumber } from '@/lib/loyalty-crypto'
import { resolveProviderKey } from '@/lib/loyalty-matching'
import { createSecretClient } from '@/lib/supabase/service'
import type { SupabaseClient } from '@supabase/supabase-js'

type DbClient = SupabaseClient

interface LoyaltyProgramRow {
  id: string
  traveler_name: string
  provider_name: string
  provider_key: string
  program_number_encrypted: string
  program_number_masked: string
  preferred: boolean
  updated_at: string
}

interface ProviderCatalogRow {
  provider_key: string
  provider_name: string
  alliance_group: string | null
}

interface ProviderMatch {
  resolvedProviderKey: string
  providerName: string
  allianceGroup: string | null
  exactProgram: LoyaltyProgramRow | null
  compatibleProgram: LoyaltyProgramRow | null
}

function normalizeAlnum(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

async function matchProviderForUser(
  supabase: DbClient,
  userId: string,
  providerName: string
): Promise<ProviderMatch | null> {
  const resolvedProviderKey = resolveProviderKey(providerName)
  if (!resolvedProviderKey) return null

  const { data: providerRow } = await supabase
    .from('provider_catalog')
    .select('provider_key, provider_name, alliance_group')
    .eq('provider_key', resolvedProviderKey)
    .maybeSingle()

  const provider = (providerRow as ProviderCatalogRow | null) ?? null

  const { data: exactMatch } = await supabase
    .from('loyalty_programs')
    .select('id, traveler_name, provider_name, provider_key, program_number_encrypted, program_number_masked, preferred, updated_at')
    .eq('user_id', userId)
    .eq('provider_key', resolvedProviderKey)
    .order('preferred', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let compatibleProgram: LoyaltyProgramRow | null = null
  const allianceGroup = provider?.alliance_group ?? null

  if (!exactMatch && allianceGroup && allianceGroup !== 'none') {
    const { data: allianceProviders } = await supabase
      .from('provider_catalog')
      .select('provider_key')
      .eq('alliance_group', allianceGroup)

    const providerKeys = (allianceProviders ?? [])
      .map((row) => (row as { provider_key?: string }).provider_key)
      .filter((key): key is string => typeof key === 'string' && key.length > 0)

    if (providerKeys.length > 0) {
      const { data: compatibleMatch } = await supabase
        .from('loyalty_programs')
        .select('id, traveler_name, provider_name, provider_key, program_number_encrypted, program_number_masked, preferred, updated_at')
        .eq('user_id', userId)
        .in('provider_key', providerKeys)
        .order('preferred', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      compatibleProgram = (compatibleMatch as LoyaltyProgramRow | null) ?? null
    }
  }

  return {
    resolvedProviderKey,
    providerName: provider?.provider_name ?? providerName,
    allianceGroup,
    exactProgram: (exactMatch as LoyaltyProgramRow | null) ?? null,
    compatibleProgram,
  }
}

async function setTripItemFlag(
  supabase: DbClient,
  tripItemId: string,
  loyaltyFlag: Record<string, unknown>
) {
  await supabase
    .from('trip_items')
    .update({ loyalty_flag: loyaltyFlag })
    .eq('id', tripItemId)
}

export async function applyEmailLoyaltyFlag(params: {
  supabase?: DbClient
  userId: string
  tripItemId: string
  providerName: string | null
  rawEmailText: string
}) {
  const providerName = params.providerName?.trim()
  if (!providerName) return

  const supabase = params.supabase ?? createSecretClient()
  const match = await matchProviderForUser(supabase, params.userId, providerName)
  if (!match) return

  const now = new Date().toISOString()

  if (match.exactProgram) {
    const number = decryptLoyaltyNumber(match.exactProgram.program_number_encrypted)
    const numberInEmail = normalizeAlnum(params.rawEmailText).includes(normalizeAlnum(number))

    await setTripItemFlag(supabase, params.tripItemId, {
      status: numberInEmail ? 'applied' : 'missing_from_booking',
      provider_key: match.resolvedProviderKey,
      program: match.exactProgram.provider_name,
      traveler_name: match.exactProgram.traveler_name,
      number_masked: match.exactProgram.program_number_masked,
      flagged_at: now,
    })
    return
  }

  if (match.compatibleProgram) {
    await setTripItemFlag(supabase, params.tripItemId, {
      status: 'compatible_available',
      provider_key: match.resolvedProviderKey,
      provider_name: match.providerName,
      alliance_group: match.allianceGroup,
      compatible_program: {
        provider_name: match.compatibleProgram.provider_name,
        traveler_name: match.compatibleProgram.traveler_name,
        number_masked: match.compatibleProgram.program_number_masked,
      },
      flagged_at: now,
    })
    return
  }

  await setTripItemFlag(supabase, params.tripItemId, {
    status: 'no_vault_entry',
    provider_name: match.providerName,
    provider_key: match.resolvedProviderKey,
    flagged_at: now,
  })
}

export async function applyNoVaultEntryFlag(params: {
  supabase?: DbClient
  userId: string
  tripItemId: string
  providerName: string | null
}) {
  const providerName = params.providerName?.trim()
  if (!providerName) return

  const supabase = params.supabase ?? createSecretClient()
  const match = await matchProviderForUser(supabase, params.userId, providerName)
  if (!match) return

  if (match.exactProgram || match.compatibleProgram) return

  await setTripItemFlag(supabase, params.tripItemId, {
    status: 'no_vault_entry',
    provider_name: match.providerName,
    provider_key: match.resolvedProviderKey,
    flagged_at: new Date().toISOString(),
  })
}
