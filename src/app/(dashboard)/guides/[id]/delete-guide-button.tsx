'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteGuide } from '../actions'

export function DeleteGuideButton({ guideId }: { guideId: string }) {
  const [pending, setPending] = useState(false)

  const handleDelete = async () => {
    if (!confirm('Delete this guide and all its entries? This cannot be undone.')) return
    setPending(true)
    await deleteGuide(guideId)
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDelete}
      disabled={pending}
      className="text-red-600 hover:bg-red-50 hover:border-red-200"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  )
}
