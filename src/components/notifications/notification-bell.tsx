'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Bell, X, Check, Users, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface Notification {
  id: string
  type: 'invite_accepted' | 'entry_added' | 'collaborator_added' | string
  trip_id: string | null
  actor_id: string | null
  data: {
    trip_title?: string
    actor_name?: string
    entry_summary?: string
    entry_kind?: string
    role?: string
  }
  read_at: string | null
  created_at: string
}

function NotificationIcon({ type }: { type: string }) {
  if (type === 'invite_accepted') {
    return <Users className="h-4 w-4 text-indigo-500" />
  }
  if (type === 'entry_added') {
    return <Plus className="h-4 w-4 text-emerald-500" />
  }
  return <Bell className="h-4 w-4 text-gray-400" />
}

function notificationText(n: Notification): string {
  const actor = n.data?.actor_name || 'Someone'
  const trip = n.data?.trip_title ? `"${n.data.trip_title}"` : 'your trip'

  if (n.type === 'invite_accepted') {
    return `${actor} accepted your invite to ${trip}`
  }
  if (n.type === 'entry_added') {
    const entry = n.data?.entry_summary || n.data?.entry_kind || 'something'
    return `${actor} added "${entry}" to ${trip}`
  }
  return `New activity on ${trip}`
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/internal/notifications')
      if (!res.ok) return
      const json = await res.json()
      setNotifications(json.notifications ?? [])
      setUnreadCount(json.unread_count ?? 0)
    } catch {
      // silent fail
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch on mount and every 2 minutes
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleOpen = () => {
    setOpen((prev) => !prev)
    if (!open) fetchNotifications()
  }

  const markAllRead = async () => {
    await fetch('/api/internal/notifications/read-all', { method: 'POST' })
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })))
    setUnreadCount(0)
  }

  if (loading && notifications.length === 0) {
    // Don't render bell until we know the count
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className={cn(
          'relative flex items-center gap-1 rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900',
          open && 'bg-gray-100 text-gray-900'
        )}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <span className="text-sm font-semibold text-gray-900">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 rounded-full bg-indigo-100 px-1.5 py-0.5 text-xs font-bold text-indigo-700">
                  {unreadCount} new
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
                  title="Mark all as read"
                >
                  <Check className="h-3.5 w-3.5" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">
                No notifications yet
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={n.trip_id ? `/trips/${n.trip_id}` : '/trips'}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'flex items-start gap-3 px-4 py-3 text-sm transition-colors hover:bg-gray-50',
                        !n.read_at && 'bg-indigo-50/60 hover:bg-indigo-50'
                      )}
                    >
                      <div className="mt-0.5 shrink-0">
                        <NotificationIcon type={n.type} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-gray-800', !n.read_at && 'font-medium')}>
                          {notificationText(n)}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-400">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      {!n.read_at && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
