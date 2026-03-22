'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CityAutocomplete } from '@/components/ui/city-autocomplete'

export function HomeCityPrompt({ hasHomeCity }: { hasHomeCity: boolean }) {
  const router = useRouter()
  const [city, setCity] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (hasHomeCity) {
    // Home city is set but city isn't in tracked_cities — show a softer prompt
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-center">
        <MapPin className="mx-auto mb-2 h-8 w-8 text-slate-300" />
        <p className="text-sm font-medium text-slate-600">Your home city isn&apos;t tracked yet.</p>
        <p className="mt-1 text-xs text-slate-400">
          We&apos;ll add event coverage as we expand to more cities.
        </p>
      </div>
    )
  }

  const handleSave = async () => {
    if (!city.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/me/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ home_city: city.trim() }),
      })
      if (!res.ok) {
        setError('Failed to save. Please try again.')
        return
      }
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 px-5 py-6">
      <div className="mb-3 flex items-center gap-2">
        <MapPin className="h-4 w-4 text-indigo-500" />
        <p className="text-sm font-semibold text-slate-800">Set your home city to see local events</p>
      </div>
      <p className="mb-4 text-xs text-slate-500">
        We&apos;ll show you what&apos;s happening nearby whenever you&apos;re not on a trip.
      </p>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <CityAutocomplete
            value={city}
            onChange={setCity}
            placeholder="Search for your city…"
          />
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving || !city.trim()}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      <p className="mt-3 text-xs text-slate-400">
        You can also set this in{' '}
        <Link href="/settings/profile" className="text-indigo-600 hover:underline">
          Settings → Profile
        </Link>
        .
      </p>
    </div>
  )
}
