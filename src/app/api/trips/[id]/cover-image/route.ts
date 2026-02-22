import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { isValidUUID } from '@/lib/validation'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY!

// SECURITY: Allowed file types for cover images
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
])

// SECURITY: Allowed extensions (derived from filename)
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])

// SECURITY: Max upload size: 5 MB
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024

// SECURITY: Only allow Unsplash image URLs as external cover images
const ALLOWED_IMAGE_HOSTNAMES = [
  'images.unsplash.com',
  'plus.unsplash.com',
]

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params

  // SECURITY: Validate route param is a well-formed UUID
  if (!isValidUUID(tripId)) {
    return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 })
  }

  // SECURITY: Verify user is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // SECURITY: Verify user owns this trip via RLS-enforced query
  const { data: trip } = await supabase
    .from('trips')
    .select('id, user_id')
    .eq('id', tripId)
    .single()

  if (!trip || trip.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const unsplashUrl = formData.get('unsplash_url') as string | null

  let coverImageUrl: string | null = null

  if (unsplashUrl) {
    // SECURITY: Validate that the URL is actually from Unsplash — don't allow arbitrary URLs
    if (!isAllowedUnsplashUrl(unsplashUrl)) {
      return NextResponse.json(
        { error: 'Only Unsplash image URLs are allowed' },
        { status: 400 }
      )
    }
    coverImageUrl = unsplashUrl

  } else if (file) {
    // SECURITY: Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB` },
        { status: 400 }
      )
    }

    // SECURITY: Validate MIME type against allowlist
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed' },
        { status: 400 }
      )
    }

    // SECURITY: Validate extension from filename against allowlist
    const rawExt = (file.name.split('.').pop() || '').toLowerCase()
    if (!ALLOWED_EXTENSIONS.has(rawExt)) {
      return NextResponse.json(
        { error: 'Invalid file extension' },
        { status: 400 }
      )
    }

    // SECURITY: Use only the validated extension — never trust the full filename for paths
    const safeExt = rawExt
    // SECURITY: Build storage path with only user.id and tripId (both UUIDs) — no user-controlled data in path
    const path = `${user.id}/${tripId}.${safeExt}`

    const serviceClient = createServiceClient(SUPABASE_URL, SUPABASE_SECRET_KEY)

    const { error } = await serviceClient.storage
      .from('trip-images')
      .upload(path, file, {
        upsert: true,
        contentType: file.type,
      })

    if (error) {
      console.error('Storage upload error:', error)
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }

    const { data: { publicUrl } } = serviceClient.storage
      .from('trip-images')
      .getPublicUrl(path)

    coverImageUrl = publicUrl

  } else {
    return NextResponse.json({ error: 'No file or URL provided' }, { status: 400 })
  }

  // Update trip (uses RLS-enforced user client — only owner can update)
  const { error: updateError } = await supabase
    .from('trips')
    .update({ cover_image_url: coverImageUrl })
    .eq('id', tripId)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update trip' }, { status: 500 })
  }

  return NextResponse.json({ cover_image_url: coverImageUrl })
}
