import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardNav } from '@/components/dashboard-nav'
import { UpgradeBanner } from '@/components/billing/upgrade-banner'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const subscriptionTier = (
    profile as { subscription_tier?: string | null } | null
  )?.subscription_tier

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#ffffff]/50 to-[#f1f5f9]/30">
      <DashboardNav user={user} profile={profile} />
      <UpgradeBanner subscriptionTier={subscriptionTier} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
