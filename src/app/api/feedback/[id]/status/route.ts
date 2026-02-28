import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidUUID } from '@/lib/validation'

const FEEDBACK_STATUSES = new Set([
  'new',
  'under_review',
  'planned',
  'in_progress',
  'shipped',
  'declined',
])

function feedbackImagePathFromPublicUrl(imageUrl: string): string | null {
  try {
    const parsed = new URL(imageUrl)
    const marker = '/storage/v1/object/public/feedback-images/'
    const index = parsed.pathname.indexOf(marker)
    if (index === -1) return null

    const path = parsed.pathname.slice(index + marker.length)
    return path ? decodeURIComponent(path) : null
  } catch {
    return null
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Invalid feedback ID' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = (await request.json().catch(() => null)) as { status?: unknown } | null
  const status = typeof payload?.status === 'string' ? payload.status : ''
  if (!FEEDBACK_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('feedback')
    .select('id, user_id, status, image_url')
    .eq('id', id)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let nextImageUrl = existing.image_url

  if (existing.status !== 'shipped' && status === 'shipped' && existing.image_url) {
    const imagePath = feedbackImagePathFromPublicUrl(existing.image_url)
    if (imagePath) {
      await supabase.storage.from('feedback-images').remove([imagePath])
      nextImageUrl = null
    }
  }

  const { data: updated, error } = await supabase
    .from('feedback')
    .update({ status, image_url: nextImageUrl })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, user_id, type, title, body, image_url, status, votes, created_at, updated_at')
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: 'Could not update status' }, { status: 500 })
  }

  return NextResponse.json({ data: updated })
}
