'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check, Users, Crown } from 'lucide-react'

interface ReferralStats {
  referral_code: string
  referral_link: string
  signed_up_count: number
  converted_count: number
}

export function ReferralsSection() {
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        const res = await fetch('/api/v1/referral')
        const payload = await res.json()

        if (!res.ok) {
          throw new Error(payload?.error?.message ?? 'Failed to load referral data.')
        }

        if (mounted) {
          setStats(payload.data as ReferralStats)
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load referral data.')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [])

  const handleCopy = async () => {
    if (!stats?.referral_link) return
    await navigator.clipboard.writeText(stats.referral_link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading referral stats…</p>
  }

  if (error || !stats) {
    return <p className="text-sm text-red-600">{error ?? 'Referral data is unavailable right now.'}</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
          Your Referral Link
        </label>
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-gray-700 font-mono truncate">
            {stats.referral_link}
          </div>
          <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
            {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[#e5e7eb] bg-white p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Users className="h-4 w-4" />
            Signed Up
          </div>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{stats.signed_up_count}</p>
        </div>
        <div className="rounded-lg border border-[#e5e7eb] bg-white p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Crown className="h-4 w-4" />
            Converted to Pro
          </div>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{stats.converted_count}</p>
        </div>
      </div>
    </div>
  )
}
