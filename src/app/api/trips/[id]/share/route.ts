import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { nanoid } from 'nanoid'
import { isValidUUID } from '@/lib/validation'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ubtrippin.xyz'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params

  // SECURITY: Validate route param is a well-formed UUID
  if (!isValidUUID(tripId)) {
    return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: trip } = await supabase
    .from('trips')
    .select('id, user_id, share_token, share_enabled')
    .eq('id', tripId)
    .single()

  if (!trip || trip.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const shareUrl = trip.share_token
    ? `${APP_URL}/share/${trip.share_token}`
    : null

  return NextResponse.json({
    share_enabled: trip.share_enabled,
    share_token: trip.share_token,
    share_url: shareUrl,
  })
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params

  // SECURITY: Validate route param is a well-formed UUID
  if (!isValidUUID(tripId)) {
    return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: trip } = await supabase
    .from('trips')
    .select('id, user_id, share_token')
    .eq('id', tripId)
    .single()

  if (!trip || trip.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Generate token if none exists, reuse existing one otherwise
  const token = trip.share_token ?? nanoid(21)

  const { error } = await supabase
    .from('trips')
    .update({ share_token: token, share_enabled: true })
    .eq('id', tripId)

  if (error) {
    return NextResponse.json({ error: 'Failed to enable sharing' }, { status: 500 })
  }

  const shareUrl = `${APP_URL}/share/${token}`

  return NextResponse.json({ share_url: shareUrl, share_token: token })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params

  // SECURITY: Validate route param is a well-formed UUID
  if (!isValidUUID(tripId)) {
    return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: trip } = await supabase
    .from('trips')
    .select('id, user_id')
    .eq('id', tripId)
    .single()

  if (!trip || trip.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Disable sharing but keep the token so it can be re-enabled later
  const { error } = await supabase
    .from('trips')
    .update({ share_enabled: false })
    .eq('id', tripId)

  if (error) {
    return NextResponse.json({ error: 'Failed to disable sharing' }, { status: 500 })
  }

  return NextResponse.json({ share_enabled: false })
}
