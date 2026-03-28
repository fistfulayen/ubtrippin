/**
 * GET  /api/v1/invites  — List caller's invites + weekly remaining count
 * POST /api/v1/invites  — Create a new invite code (Pro or admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { createUserScopedClient } from '@/lib/supabase/user-scoped'
import { createSecretClient } from '@/lib/supabase/service'
import { APP_URL } from '@/lib/invites/constants'
import { nextMondayUTC } from '@/lib/invites/next-monday'

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  const supabase = await createUserScopedClient(auth.userId)

  const { data: invites, error } = await supabase
    .from('invites')
    .select('id, code, email_used, created_at, expires_at, used_at, invitee_id')
    .eq('inviter_id', auth.userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[v1/invites GET]', error.message)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch invites.' } },
      { status: 500 }
    )
  }

  // Get remaining count via SQL function (service client — admin check inside function)
  const serviceClient = createSecretClient()
  const { data: remainingData } = await serviceClient.rpc('weekly_invites_remaining', {
    user_id: auth.userId,
  })
  const remaining: number = remainingData ?? 0

  const withUrls = (invites ?? []).map((inv) => ({
    ...inv,
    url: `${APP_URL}/join/${inv.code}`,
  }))

  return NextResponse.json({
    invites: withUrls,
    remaining,
    resets_at: nextMondayUTC(),
  })
}

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  // Check Pro or admin status
  const supabase = await createUserScopedClient(auth.userId)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('subscription_tier, is_admin')
    .eq('id', auth.userId)
    .single()

  if (profileError || !profile) {
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Could not load profile.' } },
      { status: 500 }
    )
  }

  const isPro = profile.subscription_tier === 'pro'
  const isAdmin = profile.is_admin === true

  if (!isPro && !isAdmin) {
    return NextResponse.json(
      { error: { code: 'forbidden', message: 'Invites are a Pro feature. Upgrade to send invites.' } },
      { status: 403 }
    )
  }

  // Check weekly remaining
  const serviceClient = createSecretClient()
  const { data: remainingData } = await serviceClient.rpc('weekly_invites_remaining', {
    user_id: auth.userId,
  })
  const remaining: number = remainingData ?? 0

  if (remaining <= 0) {
    return NextResponse.json(
      {
        error: {
          code: 'invite_limit_reached',
          message: 'You have used all your invites for this week. Resets next Monday UTC.',
        },
      },
      { status: 429 }
    )
  }

  // Create invite — RLS policy requires inviter_id = auth.uid(), handled by user-scoped client
  const { data: invite, error: insertError } = await supabase
    .from('invites')
    .insert({ inviter_id: auth.userId })
    .select('id, code, created_at, expires_at')
    .single()

  if (insertError || !invite) {
    console.error('[v1/invites POST]', insertError?.message)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to create invite.' } },
      { status: 500 }
    )
  }

  return NextResponse.json(
    {
      invite: {
        ...invite,
        url: `${APP_URL}/join/${invite.code}`,
      },
    },
    { status: 201 }
  )
}
