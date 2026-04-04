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
      // Velvet Rope: block new accounts created via OAuth without an invite.
      // Supabase auto-creates users on first OAuth sign-in. If the account
      // was just created (within 5 min) and has no invite record, reject it.
      const { data: userData, error: userError } = await supabase.auth.getUser()

      if (userError) {
        const sanitized = userError.message.replace(/\n/g, ' ').slice(0, 200)
        console.error('[auth callback] error fetching user:', sanitized)
      } else if (userData.user) {
        const oauthUser = userData.user
        const createdAt = new Date(oauthUser.created_at).getTime()
        const isNewAccount = !Number.isNaN(createdAt) && Date.now() - createdAt < 5 * 60 * 1000

        if (isNewAccount) {
          const { data: inviteRecord } = await supabase
            .from('invites')
            .select('id')
            .eq('invitee_id', oauthUser.id)
            .maybeSingle()

          if (!inviteRecord) {
            // New user with no invite — sign them out and reject
            await supabase.auth.signOut()
            return redirectToLoginWithError(
              origin,
              'invite_required',
              'UB Trippin is invite-only. Ask a member for an invite link to sign up.'
            )
          }
        }
      }

      await applyReferralAttribution(supabase, {
        redirectReferralCode,
        origin,
        redirectTo,
      })
      return NextResponse.redirect(new URL(redirectTo, origin))
    }

    // SECURITY (L-005): Log internal error server-side; do not expose error.message in URL.
    console.error('[auth/callback] exchangeCodeForSession failed:', error.message)
    return redirectToLoginWithError(origin, 'auth_callback_error', 'Authentication failed. Please try again.')
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

    // SECURITY (L-005): Log internal error server-side; do not expose error.message in URL.
    console.error('[auth/callback] verifyOtp failed:', error.message)
    return redirectToLoginWithError(origin, 'auth_callback_error', 'Token verification failed. Please try again.')
  }

  return redirectToLoginWithError(origin, 'auth_callback_error')
}
