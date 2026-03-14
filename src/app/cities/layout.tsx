import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { DashboardNav } from '@/components/dashboard-nav'
import { PublicNav } from '@/components/public-nav'
import { PublicFooter } from '@/components/public-footer'

export default async function CitiesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white">
        <DashboardNav user={user} profile={profile} />
        <main>{children}</main>
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

  return (
    <>
      <PublicNav />
      <main>{children}</main>
      <PublicFooter />
    </>
  )
}
