import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { createUserScopedClient } from '@/lib/supabase/user-scoped'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getAllowedAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? ''
  return new Set(
    raw
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean)
  )
}

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  const allowedEmails = getAllowedAdminEmails()
  if (allowedEmails.size === 0) {
    return NextResponse.json(
      { error: { code: 'server_misconfigured', message: 'ADMIN_EMAILS is not configured.' } },
      { status: 500 }
    )
  }

    const supabase = await createUserScopedClient(auth.userId)

  // Look up user email for admin check
  const { data: profile } = await supabase.from('profiles').select('email').eq('id', auth.userId).single()
  const email = profile?.email?.toLowerCase().trim()
  if (!email || !allowedEmails.has(email)) {
    return NextResponse.json(
      { error: { code: 'forbidden', message: 'Admin access only.' } },
      { status: 403 }
    )
  }

  const now = new Date()
  const thisWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const lastWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()

  // This week aggregate
  const { data: thisWeekRows, error: err1 } = await supabase
    .from('token_usage')
    .select('input_tokens, output_tokens, total_cost_usd')
    .gte('created_at', thisWeekStart)

  // Last week aggregate
  const { data: lastWeekRows, error: err2 } = await supabase
    .from('token_usage')
    .select('input_tokens, output_tokens, total_cost_usd')
    .gte('created_at', lastWeekStart)
    .lt('created_at', thisWeekStart)

  // Top 5 most expensive this week
  const { data: topExpensive, error: err3 } = await supabase
    .from('token_usage')
    .select('id, source_email_id, total_cost_usd, input_tokens, output_tokens, created_at')
    .gte('created_at', thisWeekStart)
    .order('total_cost_usd', { ascending: false })
    .limit(5)

  if (err1 || err2 || err3) {
    const msg = err1?.message ?? err2?.message ?? err3?.message ?? 'Query failed'
    return NextResponse.json({ error: { code: 'query_failed', message: msg } }, { status: 500 })
  }

  function aggregate(rows: { input_tokens: number; output_tokens: number; total_cost_usd: number }[]) {
    const count = rows.length
    const input_tokens = rows.reduce((s, r) => s + (r.input_tokens ?? 0), 0)
    const output_tokens = rows.reduce((s, r) => s + (r.output_tokens ?? 0), 0)
    const total_cost_usd = rows.reduce((s, r) => s + Number(r.total_cost_usd ?? 0), 0)
    const avg_cost_per_extraction = count > 0 ? total_cost_usd / count : 0
    return { count, input_tokens, output_tokens, total_cost_usd, avg_cost_per_extraction }
  }

  const thisWeek = aggregate(thisWeekRows ?? [])
  const lastWeek = aggregate(lastWeekRows ?? [])

  const costChange =
    lastWeek.total_cost_usd > 0
      ? ((thisWeek.total_cost_usd - lastWeek.total_cost_usd) / lastWeek.total_cost_usd) * 100
      : null
  const volumeChange =
    lastWeek.count > 0 ? ((thisWeek.count - lastWeek.count) / lastWeek.count) * 100 : null

  return NextResponse.json({
    this_week: thisWeek,
    last_week: lastWeek,
    trend: {
      cost_change_pct: costChange !== null ? Math.round(costChange * 10) / 10 : null,
      volume_change_pct: volumeChange !== null ? Math.round(volumeChange * 10) / 10 : null,
    },
    top_expensive: topExpensive ?? [],
  })
}
