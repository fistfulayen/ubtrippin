'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, ArrowUp } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  STATUS_BADGE_CLASS,
  STATUS_LABELS,
  TYPE_BADGE_CLASS,
  TYPE_LABELS,
  type FeedbackBoardItem,
  type FeedbackCommentItem,
} from '@/components/feedback/feedback-utils'

interface FeedbackDetailProps {
  feedback: FeedbackBoardItem
  comments: FeedbackCommentItem[]
  currentUserId: string
  currentUserName: string | null
}

export function FeedbackDetail({ feedback, comments: initialComments, currentUserId, currentUserName }: FeedbackDetailProps) {
  const supabase = createClient()

  const [item, setItem] = useState<FeedbackBoardItem>(feedback)
  const [comments, setComments] = useState<FeedbackCommentItem[]>(initialComments)
  const [commentBody, setCommentBody] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [voting, setVoting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggleVote() {
    if (voting) return

    setVoting(true)
    setError(null)

    const nextVoted = !item.voted_by_me
    const previous = item

    setItem((prev) => ({
      ...prev,
      voted_by_me: nextVoted,
      votes: nextVoted ? prev.votes + 1 : Math.max(0, prev.votes - 1),
    }))

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
      setItem(previous)
      setError('Could not update vote.')
    }

    setVoting(false)
  }

  async function handleAddComment() {
    const trimmed = commentBody.trim()
    if (!trimmed || submittingComment) return

    setSubmittingComment(true)
    setError(null)

    const { data, error: insertError } = await supabase
      .from('feedback_comments')
      .insert({
        feedback_id: item.id,
        user_id: currentUserId,
        body: trimmed,
      })
      .select('id, feedback_id, user_id, body, is_team, created_at')
      .single()

    if (insertError || !data) {
      setError('Could not add comment.')
      setSubmittingComment(false)
      return
    }

    const nextComment: FeedbackCommentItem = {
      ...(data as Omit<FeedbackCommentItem, 'author_name'>),
      author_name: currentUserName ?? 'You',
    }

    setComments((prev) => [...prev, nextComment])
    setCommentBody('')
    setSubmittingComment(false)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/feedback" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" />
        Back to feedback
      </Link>

      <article className="space-y-5 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <h1 className="text-2xl font-semibold text-gray-900">{item.title}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', TYPE_BADGE_CLASS[item.type])}>
                {TYPE_LABELS[item.type]}
              </span>
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_BADGE_CLASS[item.status])}>
                {STATUS_LABELS[item.status]}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void toggleVote()}
            disabled={voting}
            className={cn(
              'flex min-h-20 w-12 shrink-0 flex-col items-center justify-center rounded-full border border-gray-200 text-xs font-semibold transition-colors',
              item.voted_by_me ? 'text-indigo-600 bg-indigo-50 border-indigo-100' : 'text-gray-400 hover:text-gray-600'
            )}
          >
            <ArrowUp className="h-4 w-4" />
            <span>{item.votes}</span>
          </button>
        </div>

        <div className="text-sm text-gray-500">
          {item.author_name || 'Traveler'} • {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
        </div>

        <p className="whitespace-pre-wrap text-gray-700">{item.body}</p>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </article>

      <section className="space-y-4 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Comments ({comments.length})</h2>

        <div className="space-y-3">
          {comments.length === 0 ? (
            <p className="text-sm text-gray-500">No comments yet.</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span className="font-medium text-gray-700">{comment.author_name || 'Traveler'}</span>
                  {comment.is_team && (
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-medium text-indigo-700">
                      Team
                    </span>
                  )}
                  <span>{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-gray-700">{comment.body}</p>
              </div>
            ))
          )}
        </div>

        <div className="space-y-2">
          <Textarea
            placeholder="Add a comment"
            value={commentBody}
            onChange={(event) => setCommentBody(event.target.value)}
            className="min-h-24"
          />
          <div className="flex justify-end">
            <Button onClick={() => void handleAddComment()} disabled={submittingComment || !commentBody.trim()}>
              {submittingComment ? 'Posting...' : 'Post comment'}
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
