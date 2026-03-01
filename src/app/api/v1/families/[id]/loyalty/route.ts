import { NextRequest, NextResponse } from 'next/server'
import { createSecretClient } from '@/lib/supabase/service'
import { decryptLoyaltyNumber } from '@/lib/loyalty-crypto'
import { requireFamilyAccess } from '../_lib'

type Params = { params: Promise<{ id: string }> }

interface LoyaltyProgramRow {
  id: string
  user_id: string
  traveler_name: string
  provider_name: string
  provider_key: string
  program_number_encrypted: string
  program_number_masked: string
  preferred: boolean
  updated_at: string
  created_at: string
}

interface ProfileRow {
  id: string
  full_name: string | null
  email: string | null
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { id: familyId } = await params
  const access = await requireFamilyAccess(familyId)
  if ('response' in access) return access.response

  const memberUserIds = Array.from(new Set(access.ctx.members.map((member) => member.user_id)))

  // Use service client for cross-user family loyalty lookup.
  // Auth is already verified: requireFamilyAccess confirms the viewer
  // is an accepted member of this family before we reach this point.
  const service = createSecretClient()
  const { data: loyaltyRows, error: loyaltyError } = await service
    .from('loyalty_programs')
    .select('id, user_id, traveler_name, provider_name, provider_key, program_number_encrypted, program_number_masked, preferred, updated_at, created_at')
    .in('user_id', memberUserIds)
    .order('preferred', { ascending: false })
    .order('updated_at', { ascending: false })

  if (loyaltyError) {
    console.error('[v1/families/:id/loyalty GET] loyalty lookup failed', loyaltyError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to load loyalty programs.' } },
      { status: 500 }
    )
  }

  const { data: profileRows } = memberUserIds.length
    ? await service
        .from('profiles')
        .select('id, full_name, email')
        .in('id', memberUserIds)
    : { data: [] }

  const nameByUserId = new Map<string, string | null>(
    ((profileRows ?? []) as ProfileRow[]).map((row) => [row.id, row.full_name || row.email || null])
  )

  const rows = (loyaltyRows ?? []) as LoyaltyProgramRow[]
  const data = rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    traveler_name: row.traveler_name,
    provider_name: row.provider_name,
    provider_key: row.provider_key,
    program_number: decryptLoyaltyNumber(row.program_number_encrypted),
    program_number_masked: row.program_number_masked,
    preferred: row.preferred,
    updated_at: row.updated_at,
    created_at: row.created_at,
    member_name: nameByUserId.get(row.user_id) ?? null,
  }))

  return NextResponse.json({
    data,
    meta: {
      count: data.length,
      family_member_count: memberUserIds.length,
    },
  })
}
