import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY!

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params

  // Verify user owns this trip
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

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const unsplashUrl = formData.get('unsplash_url') as string | null

  let coverImageUrl: string | null = null

  if (unsplashUrl) {
    // Use Unsplash URL directly
    coverImageUrl = unsplashUrl
  } else if (file) {
    // Upload to Supabase Storage using service client
    const serviceClient = createServiceClient(SUPABASE_URL, SUPABASE_SECRET_KEY)

    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${user.id}/${tripId}.${ext}`

    const { data, error } = await serviceClient.storage
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

  // Update trip
  const { error: updateError } = await supabase
    .from('trips')
    .update({ cover_image_url: coverImageUrl })
    .eq('id', tripId)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update trip' }, { status: 500 })
  }

  return NextResponse.json({ cover_image_url: coverImageUrl })
}
