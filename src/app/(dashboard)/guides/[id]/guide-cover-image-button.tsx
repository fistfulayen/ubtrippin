'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GuideCoverImagePicker } from '@/components/guides/guide-cover-image-picker'

interface GuideCoverImageButtonProps {
  guideId: string
  currentImageUrl: string | null
}

export function GuideCoverImageButton({ guideId, currentImageUrl }: GuideCoverImageButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button size="sm" variant="outline" type="button" onClick={() => setOpen(true)}>
        <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
        {currentImageUrl ? 'Change cover' : 'Cover image'}
      </Button>

      {open && (
        <GuideCoverImagePicker
          guideId={guideId}
          onClose={() => setOpen(false)}
          onSaved={() => router.refresh()}
        />
      )}
    </>
  )
}
