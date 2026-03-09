import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sanitizeEventFeedback } from '@/lib/events/sanitize'

function startOfTodayUTC(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Authentication required.' } },
      { status: 401 }
    )
  }

  const body = (await request.json().catch(() => null)) as
    | { city_id?: string; feedback_type?: string; text?: string }
    | null

  const cityId = body?.city_id?.trim()
  const feedbackType = body?.feedback_type?.trim()
  const rawText = body?.text?.trim()

  if (!cityId || !feedbackType || !rawText) {
    return NextResponse.json(
      { error: { code: 'invalid_request', message: 'city_id, feedback_type, and text are required.' } },
      { status: 400 }
    )
  }

  const { count, error: countError } = await supabase
    .from('event_feedback')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', startOfTodayUTC())

  if (countError) {
    return NextResponse.json(
      { error: { code: 'query_failed', message: 'Unable to validate rate limit.' } },
      { status: 500 }
    )
  }

  if ((count ?? 0) >= 3) {
    return NextResponse.json(
      { error: { code: 'rate_limited', message: 'Feedback is limited to 3 submissions per day.' } },
      { status: 429 }
    )
  }

  const sanitized = sanitizeEventFeedback(rawText)
  const { error } = await supabase.from('event_feedback').insert({
    user_id: user.id,
    city_id: cityId,
    feedback_type: feedbackType,
    raw_text: rawText,
    sanitized_text: sanitized.sanitizedText,
    extracted_urls: sanitized.extractedUrls,
    extracted_event: sanitized.extractedEvent,
    status: 'pending',
  })

  if (error) {
    return NextResponse.json(
      { error: { code: 'insert_failed', message: 'Unable to store feedback.' } },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
