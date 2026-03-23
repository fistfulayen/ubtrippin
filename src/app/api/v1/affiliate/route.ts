/**
 * GET  /api/v1/affiliate  — Affiliate dashboard (stats, earnings, conversions)
 * POST /api/v1/affiliate  — Apply for affiliate program (creates pending record)
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { createUserScopedClient } from '@/lib/supabase/user-scoped'
import { createSecretClient } from '@/lib/supabase/service'

function generateAffiliateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  const supabase = await createUserScopedClient(auth.userId)

  const { data: affiliate, error } = await supabase
    .from('affiliates')
    .select('*')
    .eq('user_id', auth.userId)
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch affiliate record.' } },
      { status: 500 }
    )
  }

  if (!affiliate) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'No affiliate record found. POST to apply.' } },
      { status: 404 }
    )
  }

  const { data: conversions, error: convErr } = await supabase
    .from('affiliate_conversions')
    .select('id, commission_cents, status, created_at, paid_at')
    .eq('affiliate_id', affiliate.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (convErr) {
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch conversions.' } },
      { status: 500 }
    )
  }

  return NextResponse.json({
    data: {
      affiliate_code: affiliate.affiliate_code,
      tier: affiliate.tier,
      status: affiliate.status,
      payout_email: affiliate.payout_email,
      payout_method: affiliate.payout_method,
      total_conversions: affiliate.total_conversions,
      total_earned_cents: affiliate.total_earned_cents,
      total_paid_cents: affiliate.total_paid_cents,
      pending_payout_cents: affiliate.total_earned_cents - affiliate.total_paid_cents,
      conversions: conversions ?? [],
    },
  })
}

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  const body = await request.json().catch(() => ({}))
  const payoutEmail: string | undefined = body.payout_email
  const payoutMethod: string = body.payout_method ?? 'stripe_connect'

  if (!['stripe_connect', 'paypal'].includes(payoutMethod)) {
    return NextResponse.json(
      { error: { code: 'invalid_input', message: 'payout_method must be stripe_connect or paypal.' } },
      { status: 400 }
    )
  }

  // Use service client to check for existing + insert (avoids race on RLS insert policy)
  const service = createSecretClient()

  const { data: existing } = await service
    .from('affiliates')
    .select('id, status')
    .eq('user_id', auth.userId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: { code: 'conflict', message: `Affiliate application already exists (status: ${existing.status}).` } },
      { status: 409 }
    )
  }

  // Generate a unique code (retry up to 5 times on collision)
  let affiliateCode = ''
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateAffiliateCode()
    const { data: clash } = await service
      .from('affiliates')
      .select('id')
      .eq('affiliate_code', candidate)
      .maybeSingle()
    if (!clash) {
      affiliateCode = candidate
      break
    }
  }

  if (!affiliateCode) {
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to generate unique affiliate code.' } },
      { status: 500 }
    )
  }

  const { data: created, error: insertErr } = await service
    .from('affiliates')
    .insert({
      user_id: auth.userId,
      affiliate_code: affiliateCode,
      payout_email: payoutEmail ?? null,
      payout_method: payoutMethod,
      status: 'pending',
    })
    .select('affiliate_code, status, tier')
    .single()

  if (insertErr || !created) {
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to create affiliate application.' } },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: created }, { status: 201 })
}
