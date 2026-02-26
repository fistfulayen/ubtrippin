import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FeedbackDetail } from '@/components/feedback/feedback-detail'
import type { Feedback, FeedbackComment } from '@/types/database'
import type { FeedbackBoardItem, FeedbackCommentItem } from '@/components/feedback/feedback-utils'

interface FeedbackDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function FeedbackDetailPage({ params }: FeedbackDetailPageProps) {
  const { id } = await params

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: feedbackData } = await supabase
    .from('feedback')
    .select('id, user_id, type, title, body, status, votes, created_at, updated_at')
    .eq('id', id)
    .maybeSingle()

  if (!feedbackData) {
    notFound()
  }

  const feedback = feedbackData as Feedback

  const { data: commentsData } = await supabase
    .from('feedback_comments')
    .select('id, feedback_id, user_id, body, is_team, created_at')
    .eq('feedback_id', id)
    .order('created_at', { ascending: true })

  const comments = (commentsData ?? []) as FeedbackComment[]

  const userIds = Array.from(
    new Set([feedback.user_id, user.id, ...comments.map((comment) => comment.user_id)])
  )

  let profilesData: Array<{ id: string; full_name: string | null }> = []
  if (userIds.length > 0) {
    const { data } = await supabase.from('profiles').select('id, full_name').in('id', userIds)
    profilesData = (data ?? []) as Array<{ id: string; full_name: string | null }>
  }

  const { data: votesData } = await supabase
    .from('feedback_votes')
    .select('feedback_id')
    .eq('feedback_id', id)
    .eq('user_id', user.id)
    .limit(1)

  const nameByUserId = new Map<string, string | null>()
  for (const profile of profilesData) {
    nameByUserId.set(profile.id, profile.full_name)
  }

  const detail: FeedbackBoardItem = {
    ...feedback,
    author_name: nameByUserId.get(feedback.user_id) ?? null,
    comment_count: comments.length,
    voted_by_me: Boolean(votesData && votesData.length > 0),
  }

  const commentItems: FeedbackCommentItem[] = comments.map((comment) => ({
    ...comment,
    author_name: nameByUserId.get(comment.user_id) ?? null,
  }))

  return (
    <FeedbackDetail
      feedback={detail}
      comments={commentItems}
      currentUserId={user.id}
      currentUserName={nameByUserId.get(user.id) ?? null}
    />
  )
}
