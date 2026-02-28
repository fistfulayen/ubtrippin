'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Plane, Inbox, Settings, LogOut, Menu, X, BookOpen, Award, MessageSquare, CircleHelp } from 'lucide-react'
import { useState } from 'react'
import { UserAvatar } from '@/components/user-avatar'
import { NotificationBell } from '@/components/notifications/notification-bell'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/types/database'

interface DashboardNavProps {
  user: User
  profile: Profile | null
}

const navItems = [
  { href: '/trips', label: 'Trips', icon: Plane },
  { href: '/loyalty', label: 'Loyalty', icon: Award },
  { href: '/guides', label: 'Guides', icon: BookOpen },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/help', label: 'Help', icon: CircleHelp },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/feedback', label: 'Feedback', icon: MessageSquare },
]

export function DashboardNav({ user, profile }: DashboardNavProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  // avatar handled by UserAvatar component

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <nav className="sticky top-0 z-40 border-b border-[#cbd5e1]/50 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/trips" className="flex items-center gap-2">
            <Image
              src="/ubtrippin_logo_simple.png"
              alt="UBTRIPPIN"
              width={160}
              height={56}
              className="h-10 w-auto blend-multiply"
              priority
            />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex md:items-center md:gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-[#f1f5f9] text-[#1e293b]'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </div>

          {/* User menu (desktop) */}
          <div className="hidden md:flex md:items-center md:gap-3">
            <NotificationBell />
            <div className="flex items-center gap-3">
              <UserAvatar src={profile?.avatar_url} name={profile?.full_name} email={user.email} size="sm" />
              <span className="text-sm text-gray-700">
                {profile?.full_name || user.email}
              </span>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden rounded-lg p-2 text-gray-600 hover:bg-gray-100"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="space-y-1 px-4 py-3">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                    isActive
                      ? 'bg-[#f1f5f9] text-[#1e293b]'
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              )
            })}
          </div>
          <div className="border-t border-gray-200 px-4 py-3">
            <div className="flex items-center gap-3 mb-3">
              <UserAvatar src={profile?.avatar_url} name={profile?.full_name} email={user.email} size="md" />
              <div>
                <p className="font-medium text-gray-900">
                  {profile?.full_name || 'User'}
                </p>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
            >
              <LogOut className="h-5 w-5" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
