'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Copy, FileText, ImagePlus, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GuideCoverImagePicker } from '@/components/guides/guide-cover-image-picker'
import type { CityGuide, GuideEntry } from '@/types/database'
import { deleteGuide } from '../actions'
import { GuideCoverImageButton } from './guide-cover-image-button'
import { GuideMarkdownExport, guideToMarkdown } from './guide-markdown-export'
import { GuideShareToggle } from './guide-share-toggle'

interface GuideHeaderActionsProps {
  guide: CityGuide
  entries: GuideEntry[]
  shareUrl: string | null
}

export function GuideHeaderActions({
  guide,
  entries,
  shareUrl,
}: GuideHeaderActionsProps) {
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [coverPickerOpen, setCoverPickerOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleCopyLink = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setMobileMenuOpen(false)
  }

  const handleMarkdownExport = () => {
    const markdown = guideToMarkdown(guide, entries)
    const blob = new Blob([markdown], { type: 'text/markdown; charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${guide.city?.toLowerCase().replace(/\s+/g, '-') ?? 'guide'}.md`
    link.click()
    URL.revokeObjectURL(url)
    setMobileMenuOpen(false)
  }

  const handleDelete = async () => {
    if (!confirm('Delete this guide and all its entries? This cannot be undone.')) return
    setDeleting(true)
    setMobileMenuOpen(false)
    await deleteGuide(guide.id)
  }

  return (
    <>
      <div className="hidden flex-wrap items-center justify-end gap-2 sm:flex">
        <GuideShareToggle guideId={guide.id} isPublic={guide.is_public} shareUrl={shareUrl} />
        <GuideMarkdownExport guide={guide} entries={entries} />
        <Link href={`/guides/${guide.id}/add`}>
          <Button size="sm">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add place
          </Button>
        </Link>
        <GuideCoverImageButton guideId={guide.id} currentImageUrl={guide.cover_image_url} />
        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          disabled={deleting}
          className="text-red-600 hover:border-red-200 hover:bg-red-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex w-full items-center gap-2 sm:hidden">
        <GuideShareToggle
          guideId={guide.id}
          isPublic={guide.is_public}
          shareUrl={shareUrl}
          showCopyButton={false}
        />
        <Link href={`/guides/${guide.id}/add`} className="ml-auto">
          <Button size="sm">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add place
          </Button>
        </Link>
        <div className="relative">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label="More guide actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>

          {mobileMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMobileMenuOpen(false)} />
              <div className="absolute right-0 top-10 z-20 w-48 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                {guide.is_public && shareUrl && (
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy link
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleMarkdownExport}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Markdown
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCoverPickerOpen(true)
                    setMobileMenuOpen(false)
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  {guide.cover_image_url ? 'Change cover' : 'Cover image'}
                </button>

                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {coverPickerOpen && (
        <GuideCoverImagePicker
          guideId={guide.id}
          onClose={() => setCoverPickerOpen(false)}
          onSaved={() => {
            setCoverPickerOpen(false)
            router.refresh()
          }}
        />
      )}
    </>
  )
}
