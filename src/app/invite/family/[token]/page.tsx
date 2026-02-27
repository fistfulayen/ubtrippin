import Image from 'next/image'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { Lock } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { AcceptFamilyInviteButton } from './accept-family-invite-button'

interface FamilyInvitePageProps {
  params: Promise<{ token: string }>
}

interface FamilyInvitePreview {
  family_id: string
  family_name: string
  invited_email: string
  invited_by_name: string
  role: 'admin' | 'member'
  already_accepted: boolean
}

async function fetchInvitePreview(token: string): Promise<FamilyInvitePreview | null> {
  const headerList = await headers()
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host')
  const protocol = headerList.get('x-forwarded-proto') ?? 'http'

  if (!host) return null

  const response = await fetch(`${protocol}://${host}/api/v1/family-invites/${token}`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      cookie: headerList.get('cookie') ?? '',
    },
  })

  if (!response.ok) {
    return null
  }

  const payload = (await response.json()) as { data?: FamilyInvitePreview }
  return payload.data ?? null
}

export default async function FamilyInvitePage({ params }: FamilyInvitePageProps) {
  const { token } = await params

  if (!token || token.length > 128) {
    notFound()
  }

  const invite = await fetchInvitePreview(token)
  if (!invite) {
    notFound()
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(`/invite/family/${token}`)}`)
  }

  if (invite.already_accepted) {
    redirect('/settings/family')
  }

  if (user.email?.toLowerCase() !== invite.invited_email.toLowerCase()) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 space-y-6 text-center">
          <Lock className="mx-auto h-10 w-10 text-gray-500" />
          <h1 className="text-xl font-bold text-gray-900">Wrong account</h1>
          <p className="text-gray-600">
            This invite was sent to <strong>{invite.invited_email}</strong>. You are signed in as{' '}
            <strong>{user.email}</strong>.
          </p>
          <p className="text-sm text-gray-500">
            Please sign out and sign in with the invited email to accept this family invite.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Image
            src="/ubtrippin_logo_simple.png"
            alt="UBTRIPPIN"
            width={240}
            height={83}
            className="mx-auto blend-multiply"
            priority
          />
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">Family invite</p>
            <h1 className="text-2xl font-bold text-gray-900">
              {invite.invited_by_name} invited you to join {invite.family_name}
            </h1>
            <p className="text-gray-600">
              Sharing is caring. Once you join, your family shares trips, loyalty programs, guides,
              and travel preferences.
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 space-y-2">
            <p className="text-sm text-gray-500">Invited email</p>
            <p className="font-medium text-gray-900">{invite.invited_email}</p>
          </div>

          <AcceptFamilyInviteButton token={token} />
        </div>
      </div>
    </div>
  )
}
