'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trash2, Mail } from 'lucide-react'
import type { AllowedSender } from '@/types/database'

interface AllowedSendersListProps {
  senders: AllowedSender[]
}

export function AllowedSendersList({ senders }: AllowedSendersListProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    setDeleting(id)

    const supabase = createClient()
    await supabase.from('allowed_senders').delete().eq('id', id)

    setDeleting(null)
    router.refresh()
  }

  if (senders.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center">
        <Mail className="mx-auto h-8 w-8 text-gray-400" />
        <p className="mt-2 text-sm text-gray-600">
          No allowed senders yet. Add your email address above.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-700">Your allowed senders</h4>
      <div className="divide-y divide-gray-100 rounded-lg border">
        {senders.map((sender) => (
          <div
            key={sender.id}
            className="flex items-center justify-between gap-4 p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 truncate">
                  {sender.email}
                </span>
                {sender.label && (
                  <Badge variant="secondary" className="shrink-0">
                    {sender.label}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Added {new Date(sender.created_at).toLocaleDateString()}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(sender.id)}
              disabled={deleting === sender.id}
              className="text-gray-400 hover:text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
