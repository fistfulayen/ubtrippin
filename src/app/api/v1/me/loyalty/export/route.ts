import { NextResponse } from 'next/server'
import { requireSessionAuth, isSessionAuthError } from '@/lib/api/session-auth'
import { decryptLoyaltyNumber } from '@/lib/loyalty-crypto'

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

export async function GET() {
  const auth = await requireSessionAuth()
  if (isSessionAuthError(auth)) return auth

  const { data, error } = await auth.supabase
    .from('loyalty_programs')
    .select('*')
    .eq('user_id', auth.userId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[v1/me/loyalty/export GET] Supabase error:', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to export loyalty vault.' } },
      { status: 500 }
    )
  }

  const rows = (data ?? []) as LoyaltyProgramRow[]
  const exportPayload = {
    exported_at: new Date().toISOString(),
    user_id: auth.userId,
    count: rows.length,
    programs: rows.map((row) => ({
      id: row.id,
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
    })),
  }

  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename=loyalty-vault.json',
    },
  })
}
