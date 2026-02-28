import { createClient } from '@/lib/supabase/server'
import { resolveSafeRedirectFromSearchParams } from '@/lib/supabase/auth'
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

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
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
      return NextResponse.redirect(new URL(redirectTo, origin))
    }

    return redirectToLoginWithError(origin, 'auth_callback_error', error.message)
  }

  return redirectToLoginWithError(origin, 'auth_callback_error')
}
