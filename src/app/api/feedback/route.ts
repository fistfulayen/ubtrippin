import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function normalizeFeedbackType(value: unknown): 'bug' | 'feature' | 'general' {
  if (value === 'bug' || value === 'feature' || value === 'general') return value
  return 'general'
}

function extensionFromMimeType(type: string): string {
  if (type === 'image/jpeg') return 'jpg'
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  return 'bin'
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
  const maybeImage = formData.get('image')

  if (!title || !body) {
    return NextResponse.json({ error: 'Title and details are required.' }, { status: 400 })
  }

  let imageUrl: string | null = null
  let imagePath: string | null = null

  if (maybeImage instanceof File && maybeImage.size > 0) {
    if (maybeImage.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Image must be 5MB or smaller.' }, { status: 400 })
    }

    if (!ALLOWED_IMAGE_TYPES.has(maybeImage.type)) {
      return NextResponse.json({ error: 'Image must be JPG, PNG, or WebP.' }, { status: 400 })
    }

    const ext = extensionFromMimeType(maybeImage.type)
    imagePath = `${user.id}/${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('feedback-images')
      .upload(imagePath, maybeImage, {
        contentType: maybeImage.type,
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: 'Could not upload image.' }, { status: 500 })
    }

    const { data: publicUrlData } = supabase.storage
      .from('feedback-images')
      .getPublicUrl(imagePath)

    imageUrl = publicUrlData.publicUrl
  }

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
    if (imagePath) {
      await supabase.storage.from('feedback-images').remove([imagePath])
    }
    return NextResponse.json({ error: 'Unable to submit feedback right now.' }, { status: 500 })
  }

  return NextResponse.json({ data })
}
