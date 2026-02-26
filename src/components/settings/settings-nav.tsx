'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const items = [
  { href: '/settings', label: 'General' },
  { href: '/settings/profile', label: 'Traveler Profile' },
  { href: '/settings/webhooks', label: 'Webhooks' },
]

export function SettingsNav() {
  const pathname = usePathname()

  return (
    <div className="rounded-lg border border-[#cbd5e1] bg-white p-1">
      <div className="flex flex-wrap gap-1">
        {items.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[#f1f5f9] text-[#1e293b]'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
