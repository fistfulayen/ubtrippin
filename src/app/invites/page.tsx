'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Check, Copy, Loader2, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Invite {
  id: string
  code: string
  email_used: string | null
  created_at: string
  expires_at: string
  used_at: string | null
  invitee_id: string | null
  url: string
}

interface InvitesData {
  invites: Invite[]
  remaining: number
  resets_at: string
}

interface ReferralEntry {
  invitee_id: string
  invitee_name: string | null
  joined_at: string
  depth: number
}

interface Profile {
  subscription_tier: string | null
  is_admin: boolean
}

type InviteStatus = 'available' | 'pending' | 'accepted' | 'expired'

function getStatus(invite: Invite): InviteStatus {
  if (invite.used_at) return 'accepted'
  if (new Date(invite.expires_at) < new Date()) return 'expired'
  return 'pending'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: select input
    }
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
    >
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function RemainingBadge({ remaining }: { remaining: number }) {
  const color =
    remaining === 0 ? 'bg-slate-100 text-slate-500' : 'bg-indigo-50 text-indigo-700'
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${color}`}>
      {remaining === 0 ? 'No invites left this week' : `${remaining} invite${remaining === 1 ? '' : 's'} left this week`}
    </span>
  )
}

function InviteSlot({
  invite,
  onRevoke,
  revoking,
}: {
  invite: Invite | null
  onRevoke?: (id: string) => void
  revoking?: boolean
}) {
  const status: InviteStatus = invite ? getStatus(invite) : 'available'

  if (status === 'available' || !invite) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-200 px-4 py-4 text-sm text-slate-400 italic">
        Available — generate an invite link below
      </div>
    )
  }

  if (status === 'accepted') {
    return (
      <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-4 py-3">
        <div className="text-sm">
          <span className="font-medium text-green-800">{invite.email_used ?? 'Someone'}</span>{' '}
          <span className="text-green-700">joined on {formatDate(invite.used_at!)}</span>
        </div>
        <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
      </div>
    )
  }

  if (status === 'expired') {
    return (
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400">
        <span>Expired — slot frees next week</span>
        <span className="font-mono text-xs">{invite.code}</span>
      </div>
    )
  }

  // pending
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 space-y-2">
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={invite.url}
          className="flex-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-mono text-slate-600 focus:outline-none"
        />
        <CopyButton text={invite.url} />
      </div>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Expires {formatDate(invite.expires_at)}</span>
        {onRevoke && (
          <button
            onClick={() => onRevoke(invite.id)}
            disabled={revoking}
            className="text-red-400 hover:text-red-600 disabled:opacity-50"
          >
            {revoking ? 'Revoking…' : 'Revoke'}
          </button>
        )}
      </div>
    </div>
  )
}

function ReferralTree({ entries }: { entries: ReferralEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-400 italic">No one yet.</p>
  }

  const byDepth: Record<number, ReferralEntry[]> = {}
  for (const e of entries) {
    if (!byDepth[e.depth]) byDepth[e.depth] = []
    byDepth[e.depth].push(e)
  }

  return (
    <div className="space-y-1">
      {entries.map((e) => (
        <div
          key={e.invitee_id}
          className="flex items-center gap-2 text-sm text-slate-700"
          style={{ paddingLeft: `${(e.depth - 1) * 20}px` }}
        >
          <span className="text-slate-400 select-none">{'└─'}</span>
          <span className="font-medium">{e.invitee_name ?? 'Unknown'}</span>
          <span className="text-slate-400 text-xs">— joined {formatDate(e.joined_at)}</span>
        </div>
      ))}
    </div>
  )
}

export default function InvitesPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [data, setData] = useState<InvitesData | null>(null)
  const [crew, setCrew] = useState<ReferralEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState<string | null>(null)

  // Fetch the user's API key from settings (stored in api_keys table)
  // We use Supabase client directly since this is a dashboard page (session auth)
  const fetchProfile = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: p } = await supabase
      .from('profiles')
      .select('subscription_tier, is_admin')
      .eq('id', user.id)
      .single()

    if (p) setProfile(p as Profile)

    // Fetch first active API key for this user to make v1 calls
    const { data: keys } = await supabase
      .from('api_keys')
      .select('raw_key, key_hash')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)

    // api_keys stores key_hash, not raw_key — we'll use supabase session for these calls
    // Actually, we'll make the calls server-side via session auth
    // For dashboard pages we'll call the v1 API with the session cookie approach
    // But v1/invites uses validateApiKey (bearer).
    // Solution: call from server action or add session-auth path.
    // For now: fetch invites directly from Supabase client (RLS-scoped).
    void keys // not used — see below
    await fetchInvitesDirect(supabase, user.id)
  }, [])

  const fetchInvitesDirect = async (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase client typing varies
    supabase: any,
    userId: string
  ) => {
    const { data: invites } = await supabase
      .from('invites')
      .select('id, code, email_used, created_at, expires_at, used_at, invitee_id')
      .eq('inviter_id', userId)
      .order('created_at', { ascending: false })

    // weekly_invites_remaining via RPC
    const { data: remaining } = await supabase.rpc('weekly_invites_remaining', {
      user_id: userId,
    })

    const APP_URL = 'https://www.ubtrippin.xyz'
    const withUrls = (invites ?? []).map((inv: Invite) => ({
      ...inv,
      url: `${APP_URL}/join/${inv.code}`,
    }))

    const nextMonday = (() => {
      const now = new Date()
      const day = now.getUTCDay()
      const daysUntil = day === 0 ? 1 : 8 - day
      const next = new Date(now)
      next.setUTCDate(now.getUTCDate() + daysUntil)
      next.setUTCHours(0, 0, 0, 0)
      return next.toISOString()
    })()

    setData({
      invites: withUrls,
      remaining: remaining ?? 0,
      resets_at: nextMonday,
    })

    // Fetch referral tree
    const { data: tree } = await supabase.rpc('get_referral_tree', { user_id: userId })
    setCrew(tree ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const handleCreate = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setCreating(true)
    const { data: invite, error } = await supabase
      .from('invites')
      .insert({ inviter_id: user.id })
      .select('id, code, created_at, expires_at')
      .single()

    if (error || !invite) {
      setCreating(false)
      return
    }

    // Refresh
    await fetchInvitesDirect(supabase, user.id)
    setCreating(false)
  }

  const handleRevoke = async (inviteId: string) => {
    // Revoke = delete the invite (if unused)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setRevoking(inviteId)
    await supabase
      .from('invites')
      .delete()
      .eq('id', inviteId)
      .eq('inviter_id', user.id)
      .is('used_at', null)

    await fetchInvitesDirect(supabase, user.id)
    setRevoking(null)
  }

  const isPro = profile?.subscription_tier === 'pro'
  const isAdmin = profile?.is_admin === true
  const canInvite = isPro || isAdmin

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  if (!canInvite) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">Invites</h1>
        <div className="rounded-xl border-2 border-indigo-100 bg-indigo-50 p-6 space-y-3">
          <p className="font-semibold text-indigo-800">Invites are a Pro feature.</p>
          <p className="text-sm text-indigo-700">
            Upgrade to Pro and you&apos;ll get 3 fresh invites every Monday to share with friends.
          </p>
          <Link
            href="/settings/billing"
            className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            Upgrade to Pro
          </Link>
        </div>
      </div>
    )
  }

  const invites = data?.invites ?? []
  const remaining = data?.remaining ?? 0

  // Build 3 slots: accepted/pending/expired from most recent, pad with nulls
  const activeInvites = invites.filter((i) => getStatus(i) !== 'expired').slice(0, 3)
  const slots: (Invite | null)[] = [
    activeInvites[0] ?? null,
    activeInvites[1] ?? null,
    activeInvites[2] ?? null,
  ]

  return (
    <div className="max-w-lg mx-auto px-4 py-10 space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Invites</h1>
          <p className="text-sm text-slate-500 mt-1">
            3 fresh invites every Monday. Unused ones don&apos;t roll over.
          </p>
        </div>
        <RemainingBadge remaining={remaining} />
      </div>

      {/* Slots */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          This Week&apos;s Invites
        </h2>
        <div className="space-y-3">
          {slots.map((slot, i) => (
            <InviteSlot
              key={slot?.id ?? `empty-${i}`}
              invite={slot}
              onRevoke={handleRevoke}
              revoking={revoking === slot?.id}
            />
          ))}
        </div>

        {remaining > 0 && (
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-2 rounded-lg border-2 border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 transition-colors disabled:opacity-50"
          >
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Generate invite link
              </>
            )}
          </button>
        )}
      </section>

      {/* Crew */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Your Crew
        </h2>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <ReferralTree entries={crew} />
        </div>
        <p className="text-xs text-slate-400">
          People you&apos;ve invited, and people they&apos;ve invited (up to 3 levels).
        </p>
      </section>

      {/* Resets note */}
      {data?.resets_at && (
        <p className="text-xs text-slate-400 text-center">
          Weekly invite count resets{' '}
          {new Date(data.resets_at).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
          })}{' '}
          at midnight UTC.
        </p>
      )}
    </div>
  )
}
