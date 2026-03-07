import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { normalizeReferralCode, resolveReferrerIdByCode } from '@/lib/referrals'

interface ReferralLandingPageProps {
  params: Promise<{ code: string }>
}

export default async function ReferralLandingPage({ params }: ReferralLandingPageProps) {
  const { code } = await params
  const normalizedCode = normalizeReferralCode(code)

  if (!normalizedCode) {
    redirect('/')
  }

  const supabase = await createClient()
  const referrerId = await resolveReferrerIdByCode(supabase, normalizedCode)

  if (!referrerId) {
    redirect('/')
  }

  redirect(`/login?ref=${encodeURIComponent(normalizedCode)}`)
}
