import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { resolveSafeRedirectFromSearchParams } from '@/lib/supabase/auth'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to
  // debug issues with users being randomly logged out.
  //
  // IMPORTANT: getClaims() validates the JWT locally (no network call),
  // refreshes expired tokens, and sets updated cookies on the response.
  // Using getUser() here caused intermittent auth failures on Vercel.
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims

  // Protected routes that require authentication
  const protectedPaths = ['/trips', '/inbox', '/settings']
  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  ) && request.nextUrl.pathname !== '/trips/demo'

  const isLoginPath = request.nextUrl.pathname === '/login'
  // Authentication endpoints must remain reachable while obtaining admission.
  // An account may also revoke its own keys after admission is removed.
  const isProtectedApiPath = request.nextUrl.pathname.startsWith('/api/')
    && !request.nextUrl.pathname.startsWith('/api/v1/auth/')
    && !request.nextUrl.pathname.startsWith('/api/auth/')
    && !(request.nextUrl.pathname === '/api/keys' && request.method === 'DELETE')
  let admitted = false
  if (user && (isProtectedPath || isLoginPath || isProtectedApiPath)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('admitted_at')
      .eq('id', user.sub)
      .maybeSingle()
    admitted = Boolean(profile?.admitted_at)
  }

  if (isProtectedApiPath && user && !admitted) {
    const denied = NextResponse.json(
      { error: { code: 'forbidden', message: 'This account has not been admitted.' } },
      { status: 403 }
    )
    supabaseResponse.cookies.getAll().forEach(({ name, value, ...options }) => {
      denied.cookies.set(name, value, options)
    })
    return denied
  }

  if (isProtectedPath && (!user || !admitted)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set(
      'redirectTo',
      `${request.nextUrl.pathname}${request.nextUrl.search}`
    )
    const redirect = NextResponse.redirect(url)
    // CRITICAL: Copy refreshed auth cookies to the redirect response.
    // Without this, getClaims() token refresh is lost and auth breaks.
    supabaseResponse.cookies.getAll().forEach(({ name, value, ...options }) => {
      redirect.cookies.set(name, value, options)
    })
    return redirect
  }

  // If user is logged in and trying to access login, honor redirect target.
  if (isLoginPath && user && admitted) {
    const redirectPath = resolveSafeRedirectFromSearchParams(request.nextUrl.searchParams, {
      fallbackPath: '/trips',
      origin: request.nextUrl.origin,
    })
    const url = new URL(redirectPath, request.url)
    const redirect = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach(({ name, value, ...options }) => {
      redirect.cookies.set(name, value, options)
    })
    return redirect
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  return supabaseResponse
}
