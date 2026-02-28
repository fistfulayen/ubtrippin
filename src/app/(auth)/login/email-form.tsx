'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { buildOAuthCallbackUrl } from '@/lib/supabase/auth'

type Mode = 'sign_in' | 'sign_up' | 'magic_link' | 'forgot_password'

type FieldErrors = {
  email?: string
  password?: string
  confirmPassword?: string
  form?: string
}

function getFriendlyAuthError(message: string): string {
  const normalized = message.toLowerCase()

  if (normalized.includes('invalid login credentials')) {
    return 'Incorrect email or password.'
  }

  if (normalized.includes('email not confirmed')) {
    return 'Please confirm your email before signing in.'
  }

  if (normalized.includes('user already registered')) {
    return 'An account with this email already exists. Try signing in.'
  }

  return message
}

function validateEmail(email: string): string | undefined {
  if (!email.trim()) return 'Email is required.'
  if (!/^\S+@\S+\.\S+$/.test(email)) return 'Enter a valid email address.'
  return undefined
}

export function EmailForm({ redirectPath }: { redirectPath: string }) {
  const [mode, setMode] = useState<Mode>('sign_in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submitLabel = useMemo(() => {
    switch (mode) {
      case 'sign_in':
        return 'Sign In'
      case 'sign_up':
        return 'Create Account'
      case 'magic_link':
        return 'Send Magic Link'
      case 'forgot_password':
        return 'Send Reset Email'
      default:
        return 'Continue'
    }
  }, [mode])

  function resetStatus() {
    setErrors({})
    setSuccessMessage(null)
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode)
    setPassword('')
    setConfirmPassword('')
    resetStatus()
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resetStatus()

    const nextErrors: FieldErrors = {}
    nextErrors.email = validateEmail(email)

    if (mode === 'sign_in' || mode === 'sign_up') {
      if (!password) {
        nextErrors.password = 'Password is required.'
      } else if (mode === 'sign_up' && password.length < 8) {
        nextErrors.password = 'Password must be at least 8 characters.'
      }
    }

    if (mode === 'sign_up') {
      if (!confirmPassword) {
        nextErrors.confirmPassword = 'Please confirm your password.'
      } else if (confirmPassword !== password) {
        nextErrors.confirmPassword = 'Passwords do not match.'
      }
    }

    if (Object.values(nextErrors).some(Boolean)) {
      setErrors(nextErrors)
      return
    }

    setSubmitting(true)
    const supabase = createClient()

    try {
      if (mode === 'sign_in') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

        if (error) {
          setErrors({ form: getFriendlyAuthError(error.message) })
          return
        }

        window.location.href = redirectPath
        return
      }

      if (mode === 'sign_up') {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: buildOAuthCallbackUrl(window.location.origin, redirectPath),
          },
        })

        if (error) {
          setErrors({ form: getFriendlyAuthError(error.message) })
          return
        }

        setSuccessMessage('Account created. Check your email to confirm your account.')
        return
      }

      if (mode === 'magic_link') {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: {
            emailRedirectTo: buildOAuthCallbackUrl(window.location.origin, redirectPath),
          },
        })

        if (error) {
          setErrors({ form: getFriendlyAuthError(error.message) })
          return
        }

        setSuccessMessage('Magic link sent. Check your email to finish signing in.')
        return
      }

      const resetUrl = buildOAuthCallbackUrl(window.location.origin, '/auth/reset-password')
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: resetUrl,
      })

      if (error) {
        setErrors({ form: getFriendlyAuthError(error.message) })
        return
      }

      setSuccessMessage('Password reset email sent. Check your inbox for the link.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <button
          type="button"
          className={`rounded-lg px-3 py-2 transition ${mode === 'sign_in' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          onClick={() => switchMode('sign_in')}
        >
          Sign In
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-2 transition ${mode === 'sign_up' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          onClick={() => switchMode('sign_up')}
        >
          Sign Up
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-2 transition ${mode === 'magic_link' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          onClick={() => switchMode('magic_link')}
        >
          Magic Link
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-2 transition ${mode === 'forgot_password' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          onClick={() => switchMode('forgot_password')}
        >
          Forgot Password
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3" noValidate>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            placeholder="you@example.com"
            disabled={submitting}
          />
          {errors.email ? <p className="mt-1 text-sm text-red-600">{errors.email}</p> : null}
        </div>

        {(mode === 'sign_in' || mode === 'sign_up') && (
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === 'sign_in' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder={mode === 'sign_up' ? 'At least 8 characters' : 'Enter your password'}
              disabled={submitting}
            />
            {errors.password ? <p className="mt-1 text-sm text-red-600">{errors.password}</p> : null}
          </div>
        )}

        {mode === 'sign_up' && (
          <div>
            <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-slate-700">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="Re-enter password"
              disabled={submitting}
            />
            {errors.confirmPassword ? (
              <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
            ) : null}
          </div>
        )}

        {errors.form ? <p className="text-sm text-red-600">{errors.form}</p> : null}
        {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
        >
          {submitting ? 'Please wait...' : submitLabel}
        </button>
      </form>
    </div>
  )
}
