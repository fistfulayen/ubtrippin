import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidUUID } from '@/lib/validation'

const ALLOWED_IMAGE_HOSTNAMES = ['images.unsplash.com', 'plus.unsplash.com']

function isAllowedUnsplashUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false

    return ALLOWED_IMAGE_HOSTNAMES.some(
      (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
    )
  } catch {
    return false
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: guideId } = await params

  if (!isValidUUID(guideId)) {
    return NextResponse.json({ error: 'Invalid guide ID' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: guide } = await supabase
    .from('city_guides')
    .select('id, user_id')
    .eq('id', guideId)
    .single()

  if (!guide || guide.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const payload = (await request.json().catch(() => null)) as { unsplash_url?: unknown } | null
  const unsplashUrl = typeof payload?.unsplash_url === 'string' ? payload.unsplash_url.trim() : ''

  if (!unsplashUrl) {
    return NextResponse.json({ error: 'Missing unsplash_url' }, { status: 400 })
  }

  if (!isAllowedUnsplashUrl(unsplashUrl)) {
    return NextResponse.json({ error: 'Only Unsplash URLs are allowed' }, { status: 400 })
  }

  const { error } = await supabase
    .from('city_guides')
    .update({ cover_image_url: unsplashUrl })
    .eq('id', guideId)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: 'Failed to update guide cover image' }, { status: 500 })
  }

  return NextResponse.json({ cover_image_url: unsplashUrl })
}
