import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
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

  const subscriptionTier = profile?.subscription_tier

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#ffffff]/50 to-[#f1f5f9]/30">
      <DashboardNav user={user} profile={profile} />
      <UpgradeBanner subscriptionTier={subscriptionTier} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
      <footer className="mx-auto w-full max-w-7xl px-4 pb-6 text-xs text-gray-500 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 border-t border-gray-200 pt-4">
          <Link href="/privacy" className="hover:text-gray-700 transition-colors">
            Privacy Policy
          </Link>
          <span aria-hidden="true">•</span>
          <Link href="/terms" className="hover:text-gray-700 transition-colors">
            Terms of Service
          </Link>
        </div>
      </footer>
    </div>
  )
}
