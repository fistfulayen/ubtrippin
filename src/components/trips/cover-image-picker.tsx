'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Camera, Upload, Search, X, Loader2, Check } from 'lucide-react'

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

// Crop the image on a canvas and return a Blob
function cropImageToBlob(
  image: HTMLImageElement,
  crop: PixelCrop,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height

  canvas.width = crop.width * scaleX
  canvas.height = crop.height * scaleY

  const ctx = canvas.getContext('2d')!
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height,
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      'image/jpeg',
      0.9,
    )
  })
}

export function CoverImagePicker({ tripId, currentImageUrl, onClose }: CoverImagePickerProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cropImgRef = useRef<HTMLImageElement | null>(null)
  const [tab, setTab] = useState<'upload' | 'search'>('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UnsplashResult[]>([])
  const [searching, setSearching] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Crop state
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    cropImgRef.current = e.currentTarget
    const { width, height } = e.currentTarget
    // Default crop: centered 16:9 area
    const aspect = 16 / 9
    let cropW = width
    let cropH = width / aspect
    if (cropH > height) {
      cropH = height
      cropW = height * aspect
    }
    const x = (width - cropW) / 2
    const y = (height - cropH) / 2
    const initial: Crop = {
      unit: 'px',
      x,
      y,
      width: cropW,
      height: cropH,
    }
    setCrop(initial)
    setCompletedCrop(initial as PixelCrop)
  }, [])

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Show crop preview
    const reader = new FileReader()
    reader.onload = () => setPreviewSrc(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleCropAndUpload = async () => {
    if (!cropImgRef.current || !completedCrop) return

    setUploading(true)
    try {
      const blob = await cropImageToBlob(cropImgRef.current, completedCrop)
      const formData = new FormData()
      formData.append('file', new File([blob], 'cover.jpg', { type: 'image/jpeg' }))

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

  const handleCancelCrop = () => {
    setPreviewSrc(null)
    setCrop(undefined)
    setCompletedCrop(undefined)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-lg rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="text-lg font-semibold">
            {previewSrc ? 'Crop Image' : 'Change Cover Image'}
          </h3>
          <Button variant="ghost" size="sm" onClick={previewSrc ? handleCancelCrop : onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {previewSrc ? (
          /* Crop view */
          <div className="p-4 space-y-4">
            <p className="text-sm text-gray-500">Drag to adjust the crop area</p>
            <div className="max-h-[60vh] overflow-auto flex justify-center bg-gray-100 rounded-lg">
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={16 / 9}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewSrc}
                  alt="Crop preview"
                  onLoad={onImageLoad}
                  style={{ maxHeight: '55vh', maxWidth: '100%' }}
                />
              </ReactCrop>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCancelCrop}>
                Cancel
              </Button>
              <Button onClick={handleCropAndUpload} disabled={uploading}>
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Save
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex border-b">
              <button
                className={`flex-1 px-4 py-3 text-sm font-medium ${
                  tab === 'search'
                    ? 'border-b-2 border-[#4f46e5] text-[#4338ca]'
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
                    ? 'border-b-2 border-[#4f46e5] text-[#4338ca]'
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
                          className="relative aspect-video overflow-hidden rounded-lg hover:ring-2 hover:ring-[#4f46e5] transition-all"
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
                    className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-8 hover:border-[#4f46e5] cursor-pointer transition-colors"
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
                    onChange={handleFileSelect}
                  />
                </div>
              )}
            </div>
          </>
        )}

        {/* Loading overlay */}
        {uploading && !previewSrc && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/80">
            <Loader2 className="h-8 w-8 animate-spin text-[#4f46e5]" />
          </div>
        )}
      </div>
    </div>
  )
}
