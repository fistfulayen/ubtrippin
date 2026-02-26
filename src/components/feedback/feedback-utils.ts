export type FeedbackType = 'bug' | 'feature' | 'general'
export type FeedbackStatus = 'new' | 'under_review' | 'planned' | 'in_progress' | 'shipped' | 'declined'

export interface FeedbackBoardItem {
  id: string
  user_id: string
  type: FeedbackType
  title: string
  body: string
  status: FeedbackStatus
  votes: number
  created_at: string
  updated_at: string
  author_name: string | null
  comment_count: number
  voted_by_me: boolean
}

export interface FeedbackCommentItem {
  id: string
  feedback_id: string
  user_id: string
  body: string
  is_team: boolean
  created_at: string
  author_name: string | null
}

export const TYPE_LABELS: Record<FeedbackType, string> = {
  bug: 'Bug',
  feature: 'Feature',
  general: 'General',
}

export const STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: 'New',
  under_review: 'Under Review',
  planned: 'Planned',
  in_progress: 'In Progress',
  shipped: 'Shipped',
  declined: 'Declined',
}

export const TYPE_BADGE_CLASS: Record<FeedbackType, string> = {
  bug: 'bg-rose-50 text-rose-700 border border-rose-100',
  feature: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  general: 'bg-slate-50 text-slate-700 border border-slate-100',
}

export const STATUS_BADGE_CLASS: Record<FeedbackStatus, string> = {
  new: 'bg-gray-100 text-gray-700',
  under_review: 'bg-blue-100 text-blue-700',
  planned: 'bg-indigo-100 text-indigo-700',
  in_progress: 'bg-amber-100 text-amber-700',
  shipped: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
}
