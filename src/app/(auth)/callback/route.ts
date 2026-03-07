import { createClient } from '@/lib/supabase/server'
import { resolveSafeRedirectFromSearchParams } from '@/lib/supabase/auth'
import { normalizeReferralCode, resolveReferrerIdByCode, upsertSignedUpReferral } from '@/lib/referrals'
import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

function redirectToLoginWithError(origin: string, error: string, errorDescription?: string) {
  const loginUrl = new URL('/login', origin)
  loginUrl.searchParams.set('error', error)

  if (errorDescription) {
    loginUrl.searchParams.set('error_description', errorDescription)
  }

  return NextResponse.redirect(loginUrl)
}

function referralCodeFromRedirectPath(redirectPath: string, origin: string): string | null {
  try {
    const url = new URL(redirectPath, origin)
    return normalizeReferralCode(url.searchParams.get('ref'))
  } catch {
    return null
  }
}

async function applyReferralAttribution(
  supabase: Awaited<ReturnType<typeof createClient>>,
  options: {
    redirectReferralCode: string | null
    origin: string
    redirectTo: string
  }
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return
  }

  const metadataReferralCode = normalizeReferralCode(
    (user.user_metadata as Record<string, unknown> | undefined)?.referral_code as string | undefined
  )

  const requestedReferralCode =
    options.redirectReferralCode ?? referralCodeFromRedirectPath(options.redirectTo, options.origin)

  const referralCode = requestedReferralCode ?? metadataReferralCode
  if (!referralCode) {
    return
  }

  const { data: ownProfile, error: ownProfileError } = await supabase
    .from('profiles')
    .select('id, referred_by, created_at')
    .eq('id', user.id)
    .maybeSingle()

  if (ownProfileError || !ownProfile || ownProfile.referred_by) {
    return
  }

  // Only trust query-based referral attribution for newly created accounts.
  if (!metadataReferralCode && requestedReferralCode) {
    const createdAt = new Date(ownProfile.created_at).getTime()
    if (Number.isNaN(createdAt) || Date.now() - createdAt > 15 * 60 * 1000) {
      return
    }
  }

  const referrerId = await resolveReferrerIdByCode(supabase, referralCode)
  if (!referrerId || referrerId === user.id) {
    return
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ referred_by: referrerId })
    .eq('id', user.id)
    .is('referred_by', null)

  if (updateError) {
    console.error('[auth callback] failed to set referred_by', updateError)
    return
  }

  await upsertSignedUpReferral(supabase, referrerId, user.id)
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  const redirectTo = resolveSafeRedirectFromSearchParams(searchParams, {
    fallbackPath: '/trips',
    origin,
  })

  const authError = searchParams.get('error')
  if (authError) {
    return redirectToLoginWithError(origin, authError, searchParams.get('error_description') ?? undefined)
  }

  const supabase = await createClient()
  const redirectReferralCode = normalizeReferralCode(searchParams.get('ref'))

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      await applyReferralAttribution(supabase, {
        redirectReferralCode,
        origin,
        redirectTo,
      })
      return NextResponse.redirect(new URL(redirectTo, origin))
    }

    return redirectToLoginWithError(origin, 'auth_callback_error', error.message)
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    })

    if (!error) {
      await applyReferralAttribution(supabase, {
        redirectReferralCode,
        origin,
        redirectTo,
      })
      return NextResponse.redirect(new URL(redirectTo, origin))
    }

    return redirectToLoginWithError(origin, 'auth_callback_error', error.message)
  }

  return redirectToLoginWithError(origin, 'auth_callback_error')
}
