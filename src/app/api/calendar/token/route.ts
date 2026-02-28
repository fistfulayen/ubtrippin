import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { createClient } from '@/lib/supabase/server'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ubtrippin.xyz'

function buildFeedUrl(token: string): string {
  return `${APP_URL}/api/calendar/feed?token=${token}`
}

export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('calendar_token')
    .eq('id', user.id)
    .single()

  const token = profile?.calendar_token || null
  return NextResponse.json({
    has_token: Boolean(token),
    token,
    feed_url: token ? buildFeedUrl(token) : null,
  })
}

export async function POST(_request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.subscription_tier !== 'pro') {
    return NextResponse.json(
      { error: { code: 'pro_required', message: 'Calendar feed is available on Pro.' } },
      { status: 403 }
    )
  }

  const token = nanoid(32)
  const { error } = await supabase
    .from('profiles')
    .update({ calendar_token: token })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: 'Failed to create calendar token' }, { status: 500 })
  }

  return NextResponse.json({
    token,
    feed_url: buildFeedUrl(token),
  })
}

export async function DELETE(_request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ calendar_token: null })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: 'Failed to revoke calendar token' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
