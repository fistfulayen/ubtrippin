import { createClient } from '@/lib/supabase/server'
import { resolveSafeRedirectFromSearchParams } from '@/lib/supabase/auth'
import { normalizeReferralCode, resolveReferrerIdByCode, upsertSignedUpReferral } from '@/lib/referrals'
import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createSecretClient } from '@/lib/supabase/service'

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

  const { error: updateError } = await createSecretClient()
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

async function admitFromRelationshipInvite(
  userId: string,
  userEmail: string,
  redirectTo: string,
  origin: string
): Promise<boolean> {
  let pathname: string
  try {
    pathname = new URL(redirectTo, origin).pathname
  } catch {
    return false
  }

  const collaboratorToken = pathname.match(/^\/invite\/([^/]+)$/)?.[1]
  const familyToken = pathname.match(/^\/invite\/family\/([^/]+)$/)?.[1]
  if (!collaboratorToken && !familyToken) return false

  const secret = createSecretClient()
  const query = collaboratorToken
    ? secret
        .from('trip_collaborators')
        .select('id')
        .eq('invite_token', collaboratorToken)
        .eq('invited_email', userEmail)
        .is('accepted_at', null)
    : secret
        .from('family_members')
        .select('id')
        .eq('invite_token', familyToken as string)
        .eq('invited_email', userEmail)
        .is('accepted_at', null)
  const { data: pendingInvite } = await query.maybeSingle()
  if (!pendingInvite) return false

  const { error } = await secret
    .from('profiles')
    .update({ admitted_at: new Date().toISOString() })
    .eq('id', userId)
    .is('admitted_at', null)
  return !error
}

async function enforceDurableAdmission(
  supabase: Awaited<ReturnType<typeof createClient>>,
  redirectTo: string,
  origin: string
): Promise<NextResponse | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) return null

  const user = userData.user
  const secret = createSecretClient()
  const { data: profile } = await secret
    .from('profiles')
    .select('admitted_at')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.admitted_at) return null

  const email = user.email?.trim().toLowerCase()
  if (email && await admitFromRelationshipInvite(user.id, email, redirectTo, origin)) {
    return null
  }

  await supabase.auth.signOut()
  const { error: deleteError } = await secret.auth.admin.deleteUser(user.id)
  if (deleteError) console.error('[auth callback] failed to delete unadmitted OAuth account')
  return redirectToLoginWithError(
    origin,
    'invite_required',
    'UB Trippin is invite-only. Ask a member for an invite link to sign up.'
  )
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
      const admissionRedirect = await enforceDurableAdmission(supabase, redirectTo, origin)
      if (admissionRedirect) return admissionRedirect

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
      const admissionRedirect = await enforceDurableAdmission(supabase, redirectTo, origin)
      if (admissionRedirect) return admissionRedirect
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
