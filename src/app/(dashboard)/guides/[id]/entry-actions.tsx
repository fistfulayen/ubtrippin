'use client'

import { useState } from 'react'
import { MoreHorizontal, Pencil, Trash2, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { deleteEntry, markVisited } from '../actions'
import type { GuideEntry } from '@/types/database'

interface Props {
  entry: GuideEntry
  guideId: string
}

export function EntryActions({ entry, guideId }: Props) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`Delete "${entry.name}"?`)) return
    setDeleting(true)
    setOpen(false)
    await deleteEntry(guideId, entry.id)
    window.location.reload()
  }

  const handleMarkVisited = async () => {
    setOpen(false)
    await markVisited(guideId, entry.id)
    window.location.reload()
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        disabled={deleting}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 w-44 rounded-xl border border-gray-200 bg-white shadow-lg py-1">
            <Link
              href={`/guides/${guideId}/entries/${entry.id}/edit`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Link>

            {entry.status === 'to_try' && (
              <button
                onClick={handleMarkVisited}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-green-700 hover:bg-green-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Mark visited
              </button>
            )}

            <button
              onClick={handleDelete}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}
