'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface UnsplashResult {
  urls: {
    regular: string
    small: string
  }
  alt_description: string | null
  user: {
    name: string
  }
}

interface GuideCoverImagePickerProps {
  guideId: string
  onClose: () => void
  onSaved: () => void
}

export function GuideCoverImagePicker({ guideId, onClose, onSaved }: GuideCoverImagePickerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UnsplashResult[]>([])
  const [searching, setSearching] = useState(false)
  const [savingUrl, setSavingUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async () => {
    const query = searchQuery.trim()
    if (!query) return

    setSearching(true)
    setError(null)

    try {
      const response = await fetch(`/api/unsplash/search?q=${encodeURIComponent(query)}`)
      if (!response.ok) {
        setError('Unable to search photos right now.')
        setSearchResults([])
        setSearching(false)
        return
      }

      const payload = (await response.json()) as { results?: UnsplashResult[] }
      setSearchResults(payload.results ?? [])
    } catch {
      setError('Unable to search photos right now.')
      setSearchResults([])
    }

    setSearching(false)
  }

  const handlePick = async (url: string) => {
    if (savingUrl) return

    setSavingUrl(url)
    setError(null)

    try {
      const response = await fetch(`/api/guides/${guideId}/cover-image`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unsplash_url: url }),
      })

      if (!response.ok) {
        setError('Unable to save cover image.')
        setSavingUrl(null)
        return
      }

      onSaved()
      onClose()
    } catch {
      setError('Unable to save cover image.')
      setSavingUrl(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="text-lg font-semibold text-gray-900">Pick a cover image</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="space-y-4 p-4">
          <div className="flex gap-2">
            <Input
              value={searchQuery}
              placeholder="Search Unsplash photos..."
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void handleSearch()
                }
              }}
            />
            <Button onClick={() => void handleSearch()} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {searchResults.map((result) => {
              const isSaving = savingUrl === result.urls.regular
              return (
                <button
                  key={`${result.urls.regular}-${result.user.name}`}
                  type="button"
                  onClick={() => void handlePick(result.urls.regular)}
                  disabled={Boolean(savingUrl)}
                  className="group relative aspect-video overflow-hidden rounded-lg border border-gray-200 text-left disabled:opacity-60"
                >
                  <Image
                    src={result.urls.small}
                    alt={result.alt_description || 'Unsplash photo'}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                    sizes="(max-width: 768px) 50vw, 33vw"
                    unoptimized
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-xs text-white">
                    {isSaving ? 'Saving...' : `Photo by ${result.user.name}`}
                  </div>
                </button>
              )
            })}
          </div>

          {!searching && searchResults.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-500">Search to see photo options.</p>
          )}
        </div>
      </div>
    </div>
  )
}
