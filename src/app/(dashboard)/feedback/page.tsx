import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FeedbackBoard } from '@/components/feedback/feedback-board'
import type { Feedback } from '@/types/database'
import type { FeedbackBoardItem } from '@/components/feedback/feedback-utils'

export default async function FeedbackPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: feedbackData } = await supabase
    .from('feedback')
    .select('id, user_id, type, title, body, image_url, status, votes, created_at, updated_at')
    .order('votes', { ascending: false })
    .order('created_at', { ascending: false })

  const feedback = (feedbackData ?? []) as Feedback[]
  const feedbackIds = feedback.map((item) => item.id)
  const userIds = Array.from(new Set(feedback.map((item) => item.user_id).concat(user.id)))

  let profilesData: Array<{ id: string; full_name: string | null }> = []
  if (userIds.length > 0) {
    const { data } = await supabase.from('profiles').select('id, full_name').in('id', userIds)
    profilesData = (data ?? []) as Array<{ id: string; full_name: string | null }>
  }

  let commentsData: Array<{ feedback_id: string }> = []
  if (feedbackIds.length > 0) {
    const { data } = await supabase
      .from('feedback_comments')
      .select('feedback_id')
      .in('feedback_id', feedbackIds)
    commentsData = (data ?? []) as Array<{ feedback_id: string }>
  }

  let votesData: Array<{ feedback_id: string }> = []
  if (feedbackIds.length > 0) {
    const { data } = await supabase
      .from('feedback_votes')
      .select('feedback_id')
      .eq('user_id', user.id)
      .in('feedback_id', feedbackIds)
    votesData = (data ?? []) as Array<{ feedback_id: string }>
  }

  const nameByUserId = new Map<string, string | null>()
  for (const profile of profilesData) {
    nameByUserId.set(profile.id, profile.full_name)
  }

  const commentCountByFeedbackId = new Map<string, number>()
  for (const comment of commentsData) {
    commentCountByFeedbackId.set(
      comment.feedback_id,
      (commentCountByFeedbackId.get(comment.feedback_id) ?? 0) + 1
    )
  }

  const votedFeedbackIds = new Set(votesData.map((vote) => vote.feedback_id))

  const items: FeedbackBoardItem[] = feedback.map((item) => ({
    ...item,
    author_name: nameByUserId.get(item.user_id) ?? null,
    comment_count: commentCountByFeedbackId.get(item.id) ?? 0,
    voted_by_me: votedFeedbackIds.has(item.id),
  }))

  return (
    <FeedbackBoard
      initialItems={items}
      currentUserId={user.id}
      currentUserName={nameByUserId.get(user.id) ?? null}
    />
  )
}
