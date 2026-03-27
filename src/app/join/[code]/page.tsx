'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'

interface InviteInfo {
  valid: boolean
  inviter_name?: string
  expires_at?: string
  reason?: 'expired' | 'used' | 'not_found'
}

interface FormState {
  fullName: string
  email: string
  password: string
}

function daysUntil(isoDate: string): number {
  const diff = new Date(isoDate).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function InviterAvatar({ name }: { name: string }) {
  const letter = name.charAt(0).toUpperCase()
  const colors = [
    'bg-indigo-500',
    'bg-violet-500',
    'bg-sky-500',
    'bg-emerald-500',
    'bg-rose-500',
    'bg-amber-500',
  ]
  const color = colors[letter.charCodeAt(0) % colors.length]
  return (
    <div
      className={`${color} w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0`}
    >
      {letter}
    </div>
  )
}

export default function JoinPage() {
  const params = useParams()
  const router = useRouter()
  const code = typeof params.code === 'string' ? params.code.toUpperCase() : ''

  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FormState>({ fullName: '', email: '', password: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validate = useCallback(async () => {
    if (!code) {
      setInvite({ valid: false, reason: 'not_found' })
      setLoading(false)
      return
    }
    try {
      const res = await fetch(`/api/v1/join/${code}`)
      const data = await res.json()
      setInvite(data)
    } catch {
      setInvite({ valid: false, reason: 'not_found' })
    } finally {
      setLoading(false)
    }
  }, [code])

  useEffect(() => {
    validate()
  }, [validate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          full_name: form.fullName,
          invite_code: code,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data?.error?.message ?? 'Something went wrong. Please try again.')
        return
      }

      // Success — redirect to login with email pre-filled
      router.push(`/login?email=${encodeURIComponent(form.email)}&registered=1`)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white to-slate-100">
        <div className="text-slate-400 text-sm">Checking invite…</div>
      </div>
    )
  }

  if (!invite?.valid) {
    const messages: Record<string, string> = {
      expired: 'This invite link has expired.',
      used: 'This invite has already been used.',
      not_found: 'This invite link is not valid.',
    }
    const msg = messages[invite?.reason ?? 'not_found'] ?? messages.not_found

    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white to-slate-100 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl text-center space-y-4">
          <Image
            src="/ubtrippin_logo_simple.png"
            alt="UBTRIPPIN"
            width={400}
            height={139}
            className="mx-auto w-full max-w-[200px] blend-multiply"
            priority
          />
          <p className="text-slate-700 font-medium">{msg}</p>
          <p className="text-slate-500 text-sm">
            To get access, ask someone who uses UB Trippin for an invite.
          </p>
        </div>
      </div>
    )
  }

  const days = invite.expires_at ? daysUntil(invite.expires_at) : null

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white to-slate-100 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl space-y-6">
        {/* Logo */}
        <div className="text-center">
          <Image
            src="/ubtrippin_logo_simple.png"
            alt="UBTRIPPIN"
            width={400}
            height={139}
            className="mx-auto w-full max-w-[200px] blend-multiply"
            priority
          />
        </div>

        {/* Inviter callout */}
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <InviterAvatar name={invite.inviter_name!} />
          <p className="text-sm text-slate-700">
            <strong>{invite.inviter_name}</strong> invited you to join UB Trippin.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor="fullName">
              Full name
            </label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              required
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              placeholder="Jane Smith"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              placeholder="At least 8 characters"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        {days !== null && (
          <p className="text-center text-xs text-slate-400">
            This invite expires in {days === 0 ? 'less than a day' : `${days} day${days === 1 ? '' : 's'}`}.
          </p>
        )}
      </div>
    </div>
  )
}
