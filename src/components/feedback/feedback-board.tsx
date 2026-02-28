'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { ArrowUp, MessageSquarePlus, MessageCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  STATUS_BADGE_CLASS,
  STATUS_LABELS,
  TYPE_BADGE_CLASS,
  TYPE_LABELS,
  type FeedbackBoardItem,
  type FeedbackStatus,
  type FeedbackType,
} from '@/components/feedback/feedback-utils'

interface FeedbackBoardProps {
  initialItems: FeedbackBoardItem[]
  currentUserId: string
  currentUserName: string | null
}

type SortMode = 'votes' | 'newest'

const STATUS_FILTERS: Array<{ value: 'all' | FeedbackStatus; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'shipped', label: 'Shipped' },
]

const TYPE_FILTERS: Array<{ value: 'all' | FeedbackType; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Feature' },
  { value: 'general', label: 'General' },
]

export function FeedbackBoard({ initialItems, currentUserId, currentUserName }: FeedbackBoardProps) {
  const router = useRouter()
  const supabase = createClient()

  const [items, setItems] = useState<FeedbackBoardItem[]>(initialItems)
  const [sortMode, setSortMode] = useState<SortMode>('votes')
  const [typeFilter, setTypeFilter] = useState<'all' | FeedbackType>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | FeedbackStatus>('all')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [votingId, setVotingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [type, setType] = useState<FeedbackType>('general')
  const [imageFile, setImageFile] = useState<File | null>(null)

  const visibleItems = useMemo(() => {
    const filtered = items.filter((item) => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false
      if (statusFilter !== 'all' && item.status !== statusFilter) return false
      return true
    })

    return filtered.sort((a, b) => {
      if (sortMode === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
      if (b.votes !== a.votes) return b.votes - a.votes
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [items, sortMode, statusFilter, typeFilter])

  function showToast(message: string) {
    setToast(message)
    setTimeout(() => setToast(null), 2600)
  }

  async function handleCreate() {
    const trimmedTitle = title.trim()
    const trimmedBody = body.trim()

    if (!trimmedTitle || !trimmedBody) {
      setError('Please add a title and details.')
      return
    }

    setSaving(true)
    setError(null)

    if (imageFile) {
      const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
      if (!allowedTypes.has(imageFile.type)) {
        setError('Image must be JPG, PNG, or WebP.')
        setSaving(false)
        return
      }
      if (imageFile.size > 5 * 1024 * 1024) {
        setError('Image must be 5MB or smaller.')
        setSaving(false)
        return
      }
    }

    const formData = new FormData()
    formData.append('title', trimmedTitle)
    formData.append('body', trimmedBody)
    formData.append('type', type)
    formData.append('page_url', typeof window !== 'undefined' ? window.location.pathname : '')
    if (imageFile) {
      formData.append('image', imageFile)
    }

    let data: Omit<FeedbackBoardItem, 'author_name' | 'comment_count' | 'voted_by_me'> | null = null
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const payload = (await response.json()) as {
          data?: Omit<FeedbackBoardItem, 'author_name' | 'comment_count' | 'voted_by_me'>
        }
        data = payload.data ?? null
      }
    } catch {
      data = null
    }

    if (!data) {
      setError('Unable to submit feedback right now.')
      setSaving(false)
      return
    }

    const nextItem: FeedbackBoardItem = {
      ...(data as Omit<FeedbackBoardItem, 'author_name' | 'comment_count' | 'voted_by_me'>),
      author_name: currentUserName ?? 'You',
      comment_count: 0,
      voted_by_me: false,
    }

    setItems((prev) => [nextItem, ...prev])
    setTitle('')
    setBody('')
    setType('general')
    setImageFile(null)
    setOpen(false)
    setSaving(false)
    showToast('Thanks! We read every piece of feedback.')
  }

  async function toggleVote(item: FeedbackBoardItem) {
    if (votingId) return

    setVotingId(item.id)
    const nextVoted = !item.voted_by_me

    setItems((prev) =>
      prev.map((entry) =>
        entry.id === item.id
          ? {
              ...entry,
              voted_by_me: nextVoted,
              votes: nextVoted ? entry.votes + 1 : Math.max(0, entry.votes - 1),
            }
          : entry
      )
    )

    let voteError: unknown = null

    if (nextVoted) {
      const { error: insertError } = await supabase
        .from('feedback_votes')
        .insert({ feedback_id: item.id, user_id: currentUserId })
      voteError = insertError
    } else {
      const { error: deleteError } = await supabase
        .from('feedback_votes')
        .delete()
        .eq('feedback_id', item.id)
        .eq('user_id', currentUserId)
      voteError = deleteError
    }

    if (voteError) {
      setItems((prev) =>
        prev.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                voted_by_me: item.voted_by_me,
                votes: item.votes,
              }
            : entry
        )
      )
    }

    setVotingId(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feedback</h1>
          <p className="text-gray-600">Share ideas, vote, and track what ships next.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          New Idea
        </Button>
      </div>

      <div className="space-y-4 rounded-xl border border-gray-100 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          {TYPE_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setTypeFilter(filter.value)}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm transition-colors',
                typeFilter === filter.value
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setStatusFilter(filter.value)}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm transition-colors',
                statusFilter === filter.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Sort:</span>
          <button
            type="button"
            onClick={() => setSortMode('votes')}
            className={cn(
              'rounded-md px-2 py-1 text-sm',
              sortMode === 'votes' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            Top voted
          </button>
          <button
            type="button"
            onClick={() => setSortMode('newest')}
            className={cn(
              'rounded-md px-2 py-1 text-sm',
              sortMode === 'newest' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            Newest
          </button>
        </div>
      </div>

      {visibleItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <h2 className="text-lg font-semibold text-gray-900">Be the first to share an idea</h2>
          <p className="mt-2 text-sm text-gray-500">Your feedback helps shape the roadmap.</p>
          <Button className="mt-6" onClick={() => setOpen(true)}>
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            New Idea
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {visibleItems.map((item) => (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/feedback/${item.id}`)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  router.push(`/feedback/${item.id}`)
                }
              }}
              className="flex w-full items-start gap-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5 text-left cursor-pointer"
            >
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  void toggleVote(item)
                }}
                disabled={votingId === item.id}
                className={cn(
                  'flex min-h-20 w-12 shrink-0 flex-col items-center justify-center rounded-full border border-gray-200 text-xs font-semibold transition-colors',
                  item.voted_by_me ? 'text-indigo-600 bg-indigo-50 border-indigo-100' : 'text-gray-400 hover:text-gray-600'
                )}
              >
                <ArrowUp className="h-4 w-4" />
                <span>{item.votes}</span>
              </button>

              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-gray-900">{item.title}</h3>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', TYPE_BADGE_CLASS[item.type])}>
                    {TYPE_LABELS[item.type]}
                  </span>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_BADGE_CLASS[item.status])}>
                    {STATUS_LABELS[item.status]}
                  </span>
                </div>

                <p className="text-sm text-gray-600">
                  {item.body.length > 100 ? `${item.body.slice(0, 100)}...` : item.body}
                </p>

                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                  <span>{item.author_name || 'Traveler'}</span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5" />
                    {item.comment_count}
                  </span>
                  <span>•</span>
                  <span>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share feedback</DialogTitle>
            <DialogDescription>Tell us what is working, missing, or broken.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700" htmlFor="feedback-title">Title</label>
              <Input
                id="feedback-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Short summary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700" htmlFor="feedback-type">Type</label>
              <Select
                id="feedback-type"
                value={type}
                onChange={(event) => setType(event.target.value as FeedbackType)}
              >
                <option value="general">General</option>
                <option value="feature">Feature</option>
                <option value="bug">Bug</option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700" htmlFor="feedback-body">Details</label>
              <Textarea
                id="feedback-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="What happened? What would you like to see?"
                className="min-h-28"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700" htmlFor="feedback-image">
                Screenshot (optional)
              </label>
              <Input
                id="feedback-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null
                  setImageFile(file)
                }}
              />
              <p className="text-xs text-gray-500">Max 1 image, 5MB, JPG/PNG/WebP.</p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()} disabled={saving}>
              {saving ? 'Submitting...' : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
