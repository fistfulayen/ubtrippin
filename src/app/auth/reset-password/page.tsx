'use client'

import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type FieldErrors = {
  password?: string
  confirmPassword?: string
  form?: string
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [ready, setReady] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession()

      if (error) {
        setErrors({ form: error.message })
      }

      setHasSession(Boolean(data.session))
      setReady(true)
    }

    void loadSession()
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrors({})
    setSuccessMessage(null)

    const nextErrors: FieldErrors = {}

    if (!password) {
      nextErrors.password = 'Password is required.'
    } else if (password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters.'
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = 'Please confirm your password.'
    } else if (confirmPassword !== password) {
      nextErrors.confirmPassword = 'Passwords do not match.'
    }

    if (Object.values(nextErrors).some(Boolean)) {
      setErrors(nextErrors)
      return
    }

    setSubmitting(true)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    setSubmitting(false)

    if (error) {
      setErrors({ form: error.message })
      return
    }

    setSuccessMessage('Password updated. Redirecting to your trips...')
    window.setTimeout(() => {
      router.replace('/trips')
    }, 900)
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#ffffff] to-[#f1f5f9] p-4">
        <p className="text-slate-600">Verifying reset link...</p>
      </div>
    )
  }

  if (!hasSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#ffffff] to-[#f1f5f9] p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
          <h1 className="mb-2 text-xl font-semibold text-slate-800">Reset link invalid or expired</h1>
          <p className="mb-4 text-sm text-slate-600">
            Request a new reset email from the login page and try again.
          </p>
          <Link href="/login" className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Back to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#ffffff] to-[#f1f5f9] p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="mb-1 text-2xl font-semibold text-slate-800">Set new password</h1>
        <p className="mb-5 text-sm text-slate-600">Choose a new password for your UBTRIPPIN account.</p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="At least 8 characters"
              disabled={submitting}
            />
            {errors.password ? <p className="mt-1 text-sm text-red-600">{errors.password}</p> : null}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-slate-700">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="Re-enter new password"
              disabled={submitting}
            />
            {errors.confirmPassword ? <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p> : null}
          </div>

          {errors.form ? <p className="text-sm text-red-600">{errors.form}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
          >
            {submitting ? 'Updating password...' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}
