import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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
  )

  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', request.nextUrl.pathname)
    const redirect = NextResponse.redirect(url)
    // CRITICAL: Copy refreshed auth cookies to the redirect response.
    // Without this, getClaims() token refresh is lost and auth breaks.
    supabaseResponse.cookies.getAll().forEach(({ name, value, ...options }) => {
      redirect.cookies.set(name, value, options)
    })
    return redirect
  }

  // If user is logged in and trying to access login page, redirect to trips
  if (request.nextUrl.pathname === '/login' && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/trips'
    const redirect = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach(({ name, value, ...options }) => {
      redirect.cookies.set(name, value, options)
    })
    return redirect
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  return supabaseResponse
}
