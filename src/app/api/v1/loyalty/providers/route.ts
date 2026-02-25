import { NextResponse } from 'next/server'
import { createSecretClient } from '@/lib/supabase/service'

export async function GET() {
  const supabase = createSecretClient()

  const { data, error } = await supabase
    .from('provider_catalog')
    .select('*')
    .order('provider_type', { ascending: true })
    .order('provider_name', { ascending: true })

  if (error) {
    console.error('[v1/loyalty/providers GET] Supabase error:', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch providers.' } },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: data ?? [], meta: { count: (data ?? []).length } })
}
