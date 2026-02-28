import { createClient } from '@/lib/supabase/server'
import { resolveSafeRedirectFromSearchParams } from '@/lib/supabase/auth'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const redirectTo = resolveSafeRedirectFromSearchParams(searchParams, {
    fallbackPath: '/trips',
    origin,
  })

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(new URL(redirectTo, origin))
    }
  }

  // Auth error - redirect to login with error
  return NextResponse.redirect(new URL('/login?error=auth_callback_error', origin))
}
