'use client'

import { createClient } from '@/lib/supabase/client'
import { buildOAuthCallbackUrl, resolveSafeRedirectFromSearchParams } from '@/lib/supabase/auth'
import { useSearchParams } from 'next/navigation'
import { Suspense, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { EmailForm } from './email-form'

function LoginContent() {
  const searchParams = useSearchParams()
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleError, setGoogleError] = useState<string | null>(null)

  const redirectPath = useMemo(
    () =>
      resolveSafeRedirectFromSearchParams(searchParams, {
        fallbackPath: '/trips',
        origin: window.location.origin,
      }),
    [searchParams]
  )

  const authError = searchParams.get('error')
  const authErrorDescription = searchParams.get('error_description')

  const decodeSafely = (value: string) => {
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }

  const callbackErrorMessage = useMemo(() => {
    if (!authError) return null
    if (authError === 'auth_callback_error') return 'Could not complete authentication. Please try again.'
    return authErrorDescription ? decodeSafely(authErrorDescription) : decodeSafely(authError)
  }, [authError, authErrorDescription])

  const handleGoogleLogin = async () => {
    setGoogleError(null)
    setGoogleLoading(true)
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: buildOAuthCallbackUrl(window.location.origin, redirectPath),
      },
    })

    if (error) {
      setGoogleError(error.message)
      setGoogleLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#ffffff] to-[#f1f5f9] p-4">
      <div className="w-full max-w-md">
        <div className="space-y-6 rounded-2xl bg-white p-8 shadow-xl">
          <div className="space-y-2 text-center">
            <Image
              src="/ubtrippin_logo_simple.png"
              alt="UBTRIPPIN"
              width={400}
              height={139}
              className="mx-auto w-full max-w-xs blend-multiply"
              priority
            />
            <p className="text-slate-600">Turn your booking emails into beautiful itineraries</p>
          </div>

          <div className="space-y-2 rounded-xl bg-white p-4">
            <h2 className="font-medium text-slate-800">How it works</h2>
            <ol className="space-y-2 text-sm text-slate-700">
              <li className="flex gap-2"><span className="font-semibold">1.</span><span>Sign in with Google or email</span></li>
              <li className="flex gap-2"><span className="font-semibold">2.</span><span>Add your email to allowed senders</span></li>
              <li className="flex gap-2"><span className="font-semibold">3.</span><span>Forward booking emails to <strong>trips@ubtrippin.xyz</strong></span></li>
              <li className="flex gap-2"><span className="font-semibold">4.</span><span>Your trips are organized automatically</span></li>
            </ol>
          </div>

          {callbackErrorMessage ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {callbackErrorMessage}
            </p>
          ) : null}
          {googleError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {googleError}
            </p>
          ) : null}

          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-slate-200 bg-white px-4 py-3 font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {googleLoading ? 'Redirecting...' : 'Continue with Google'}
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs uppercase tracking-wide text-slate-500">or</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <EmailForm redirectPath={redirectPath} />

          <p className="text-center text-xs text-slate-500">
            By signing in, you agree to our <Link href="/terms" className="underline hover:text-slate-700">Terms of Service</Link>{' '}
            and <Link href="/privacy" className="underline hover:text-slate-700">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#ffffff] to-[#f1f5f9]">
          <div className="text-slate-500">Loading...</div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  )
}
