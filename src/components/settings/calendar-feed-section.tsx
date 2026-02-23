'use client'

import { useState, useEffect, useTransition } from 'react'
import { Copy, Check, RefreshCw, Calendar, ExternalLink, Rss } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CalendarTokenState {
  has_token: boolean
  token: string | null
  feed_url: string | null
}

export function CalendarFeedSection() {
  const [state, setState] = useState<CalendarTokenState | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  const fetchToken = async () => {
    try {
      const res = await fetch('/api/calendar/token')
      if (res.ok) {
        const data = await res.json()
        setState(data)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchToken()
  }, [])

  const generateToken = () => {
    startTransition(async () => {
      const res = await fetch('/api/calendar/token', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setState({ has_token: true, token: data.token, feed_url: data.feed_url })
      }
    })
  }

  const revokeToken = () => {
    startTransition(async () => {
      const res = await fetch('/api/calendar/token', { method: 'DELETE' })
      if (res.ok) {
        setState({ has_token: false, token: null, feed_url: null })
      }
    })
  }

  const copyUrl = async () => {
    if (!state?.feed_url) return
    await navigator.clipboard.writeText(state.feed_url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const googleCalendarUrl = state?.feed_url
    ? `https://calendar.google.com/calendar/r?cid=webcal://${state.feed_url.replace(/^https?:\/\//, '')}`
    : null

  if (loading) {
    return (
      <div className="h-24 flex items-center justify-center text-sm text-gray-500">
        Loading…
      </div>
    )
  }

  if (!state?.has_token) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-dashed border-[#c7c2b8] bg-[#f5f3ef]/50 p-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#eceae4]">
            <Rss className="h-5 w-5 text-[#b45309]" />
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Generate a private feed URL to subscribe from Google Calendar, Apple Calendar, or any calendar app.
            Your calendar auto-updates as new bookings are added.
          </p>
          <Button onClick={generateToken} disabled={isPending} size="sm">
            {isPending ? 'Generating…' : 'Generate Calendar Feed'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Feed URL */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
          Feed URL
        </label>
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 flex items-center gap-2 rounded-lg border border-[#c7c2b8] bg-white px-3 py-2 font-mono text-xs text-gray-700 overflow-hidden">
            <Rss className="h-3.5 w-3.5 text-[#b45309] flex-shrink-0" />
            <span className="truncate">{state.feed_url}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={copyUrl}
            className="flex-shrink-0 gap-1.5"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-green-600" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Quick add buttons */}
      <div className="flex flex-wrap gap-2">
        {googleCalendarUrl && (
          <a href={googleCalendarUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Calendar className="h-3.5 w-3.5" />
              Add to Google Calendar
              <ExternalLink className="h-3 w-3 opacity-50" />
            </Button>
          </a>
        )}
        <a
          href={state.feed_url?.replace('https:', 'webcal:') || '#'}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Calendar className="h-3.5 w-3.5" />
            Add to Apple Calendar
            <ExternalLink className="h-3 w-3 opacity-50" />
          </Button>
        </a>
      </div>

      {/* Info */}
      <p className="text-xs text-gray-500">
        Refreshes automatically every hour. Contains all your trips and booking items.
        Keep this URL private — anyone with it can view your itineraries.
      </p>

      {/* Revoke */}
      <div className="pt-1 border-t border-[#e8e5df]">
        <Button
          variant="ghost"
          size="sm"
          onClick={revokeToken}
          disabled={isPending}
          className="gap-1.5 text-xs text-gray-500 hover:text-red-600"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {isPending ? 'Revoking…' : 'Revoke & regenerate'}
        </Button>
      </div>
    </div>
  )
}
