import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_IMAGES = 3

function normalizeFeedbackType(value: unknown): 'bug' | 'feature' | 'general' {
  if (value === 'bug' || value === 'feature' || value === 'general') return value
  return 'general'
}

function extensionFromMimeType(type: string): string {
  if (type === 'image/jpeg') return 'jpg'
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  if (type === 'image/gif') return 'gif'
  return 'bin'
}

/**
 * Validate image bytes against known magic numbers and return the actual MIME type.
 * This prevents a client from uploading an arbitrary file with a spoofed Content-Type header.
 * Returns null if the bytes do not match any allowed image format.
 */
async function getValidatedMimeType(file: File): Promise<string | null> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  // JPEG: FF D8
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  // GIF: 47 49 46 38 (GIF8)
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'image/gif'
  // WebP: 52 49 46 46 ?? ?? ?? ?? 57 45 42 50 (RIFF....WEBP)
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'image/webp'
  return null
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()

  const title = (formData.get('title') as string | null)?.trim() ?? ''
  const body = (formData.get('body') as string | null)?.trim() ?? ''
  const type = normalizeFeedbackType(formData.get('type'))
  const pageUrl = (formData.get('page_url') as string | null)?.trim() || null
  const imageEntries = formData.getAll('image')

  if (!title || !body) {
    return NextResponse.json({ error: 'Title and details are required.' }, { status: 400 })
  }

  // Rate limiting: max 5 submissions per user per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count: recentCount } = await supabase
    .from('feedback')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', oneHourAgo)
  if (recentCount !== null && recentCount >= 5) {
    return NextResponse.json({ error: 'Too many submissions. Please try again later.' }, { status: 429 })
  }

  // Process up to MAX_IMAGES images
  const imageFiles = imageEntries
    .filter((entry): entry is File => entry instanceof File && entry.size > 0)
    .slice(0, MAX_IMAGES)

  const uploadedUrls: string[] = []
  const uploadedPaths: string[] = []

  for (const file of imageFiles) {
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Each image must be 5MB or smaller.' }, { status: 400 })
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Images must be JPG, PNG, WebP, or GIF.' }, { status: 400 })
    }

    const ext = extensionFromMimeType(file.type)
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('feedback-images')
      .upload(path, file, { contentType: file.type, upsert: false })

    if (uploadError) {
      // Clean up any already-uploaded images
      if (uploadedPaths.length > 0) {
        await supabase.storage.from('feedback-images').remove(uploadedPaths)
      }
      return NextResponse.json({ error: 'Could not upload image.' }, { status: 500 })
    }

    uploadedPaths.push(path)
    const { data: publicUrlData } = supabase.storage
      .from('feedback-images')
      .getPublicUrl(path)
    uploadedUrls.push(publicUrlData.publicUrl)
  }

  // Store first image in image_url for backward compatibility
  const imageUrl = uploadedUrls[0] ?? null

  const { data, error: insertError } = await supabase
    .from('feedback')
    .insert({
      user_id: user.id,
      type,
      title,
      body,
      image_url: imageUrl,
      page_url: pageUrl,
    })
    .select('id, user_id, type, title, body, image_url, status, votes, created_at, updated_at')
    .single()

  if (insertError || !data) {
    if (uploadedPaths.length > 0) {
      await supabase.storage.from('feedback-images').remove(uploadedPaths)
    }
    return NextResponse.json({ error: 'Unable to submit feedback right now.' }, { status: 500 })
  }

  // Auto-upvote: creator's own feedback starts with their vote
  await supabase.from('feedback_votes').insert({ feedback_id: data.id, user_id: user.id })
  // Update vote count to reflect the auto-vote
  await supabase.from('feedback').update({ votes: 1 }).eq('id', data.id)

  return NextResponse.json({ data: { ...data, votes: 1 } })
}
