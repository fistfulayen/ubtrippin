'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { BookOpen, Plus } from 'lucide-react'
import type { CityGuide } from '@/types/database'

interface Props {
  guides: Pick<CityGuide, 'id' | 'city' | 'country_code'>[]
  sharedName: string
  sharedUrl: string
  sharedText: string
}

export function ShareToGuideForm({ guides, sharedName, sharedUrl, sharedText }: Props) {
  const router = useRouter()
  const [selectedGuide, setSelectedGuide] = useState(guides[0]?.id ?? '')

  const getFlag = (code: string | null) => {
    if (!code) return ''
    return String.fromCodePoint(
      ...code
        .toUpperCase()
        .split('')
        .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
    )
  }

  const handleGo = () => {
    if (!selectedGuide) return
    const params = new URLSearchParams()
    if (sharedName) params.set('name', sharedName)
    if (sharedUrl) params.set('url', sharedUrl)
    if (sharedText) params.set('text', sharedText)
    router.push(`/guides/${selectedGuide}/add?${params.toString()}`)
  }

  if (guides.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-gray-600 text-sm">
          You don&apos;t have any guides yet. Create one first.
        </p>
        <Button onClick={() => router.push('/guides/new')} className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Create a guide
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Choose a guide
        </label>
        <div className="space-y-2">
          {guides.map((guide) => (
            <label
              key={guide.id}
              className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                selectedGuide === guide.id
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="guide"
                value={guide.id}
                checked={selectedGuide === guide.id}
                onChange={() => setSelectedGuide(guide.id)}
                className="sr-only"
              />
              <BookOpen
                className={`h-4 w-4 flex-shrink-0 ${
                  selectedGuide === guide.id ? 'text-indigo-600' : 'text-gray-400'
                }`}
              />
              <span className="font-medium text-gray-900">
                {guide.country_code && <span className="mr-1">{getFlag(guide.country_code)}</span>}
                {guide.city}
              </span>
            </label>
          ))}
        </div>
      </div>

      <Button onClick={handleGo} disabled={!selectedGuide} className="w-full">
        Add to guide →
      </Button>

      <div className="text-center">
        <button
          onClick={() => router.push('/guides/new')}
          className="text-sm text-gray-500 hover:text-indigo-600"
        >
          + New guide
        </button>
      </div>
    </div>
  )
}
