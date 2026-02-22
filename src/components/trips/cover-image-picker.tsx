'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Camera, Upload, Search, X, Loader2 } from 'lucide-react'

interface UnsplashResult {
  urls: { regular: string; small: string }
  alt_description: string | null
  user: { name: string }
}

interface CoverImagePickerProps {
  tripId: string
  currentImageUrl: string | null
  onClose: () => void
}

export function CoverImagePicker({ tripId, currentImageUrl, onClose }: CoverImagePickerProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<'upload' | 'search'>('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UnsplashResult[]>([])
  const [searching, setSearching] = useState(false)
  const [uploading, setUploading] = useState(false)

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const res = await fetch(`/api/unsplash/search?q=${encodeURIComponent(searchQuery)}`)
      if (res.ok) {
        const data = await res.json()
        setSearchResults(data.results || [])
      }
    } catch (err) {
      console.error('Search failed:', err)
    }
    setSearching(false)
  }

  const handleSelectUnsplash = async (url: string) => {
    setUploading(true)
    const formData = new FormData()
    formData.append('unsplash_url', url)

    try {
      const res = await fetch(`/api/trips/${tripId}/cover-image`, {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        router.refresh()
        onClose()
      }
    } catch (err) {
      console.error('Failed to set image:', err)
    }
    setUploading(false)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch(`/api/trips/${tripId}/cover-image`, {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        router.refresh()
        onClose()
      }
    } catch (err) {
      console.error('Upload failed:', err)
    }
    setUploading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="text-lg font-semibold">Change Cover Image</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            className={`flex-1 px-4 py-3 text-sm font-medium ${
              tab === 'search'
                ? 'border-b-2 border-amber-500 text-amber-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setTab('search')}
          >
            <Search className="mr-2 inline h-4 w-4" />
            Search Photos
          </button>
          <button
            className={`flex-1 px-4 py-3 text-sm font-medium ${
              tab === 'upload'
                ? 'border-b-2 border-amber-500 text-amber-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setTab('upload')}
          >
            <Upload className="mr-2 inline h-4 w-4" />
            Upload
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {tab === 'search' ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search for a destination photo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={searching}>
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                  {searchResults.map((result, i) => (
                    <button
                      key={i}
                      className="relative aspect-video overflow-hidden rounded-lg hover:ring-2 hover:ring-amber-500 transition-all"
                      onClick={() => handleSelectUnsplash(result.urls.regular)}
                      disabled={uploading}
                    >
                      <Image
                        src={result.urls.small}
                        alt={result.alt_description || 'Photo'}
                        fill
                        className="object-cover"
                        sizes="200px"
                        unoptimized
                      />
                      <div className="absolute bottom-0 inset-x-0 bg-black/50 px-2 py-1">
                        <span className="text-xs text-white">{result.user.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {searchResults.length === 0 && !searching && (
                <p className="text-center text-sm text-gray-500 py-8">
                  Search Unsplash for the perfect cover photo
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div
                className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-8 hover:border-amber-400 cursor-pointer transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="h-8 w-8 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">Click to upload a photo</p>
                <p className="text-xs text-gray-400">JPG, PNG, or WebP • Max 5MB</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          )}
        </div>

        {/* Loading overlay */}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/80">
            <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
          </div>
        )}
      </div>
    </div>
  )
}
