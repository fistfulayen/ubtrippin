import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY!

/**
 * Download an external image and upload it to Supabase Storage.
 * Returns the public URL, or null on failure.
 * This avoids hotlinking issues — we own the stored copy.
 */
export async function storeCoverImage(
  imageUrl: string,
  userId: string,
  tripId: string
): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, {
      headers: { 'User-Agent': 'UBTRIPPIN/1.0' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
      console.error('Failed to fetch cover image:', res.status, imageUrl)
      return null
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg'
    const mimeBase = contentType.split(';')[0].trim()
    const buffer = await res.arrayBuffer()

    // Skip if too large (5MB)
    if (buffer.byteLength > 5 * 1024 * 1024) {
      console.warn('Cover image too large, skipping:', buffer.byteLength)
      return null
    }

    const ext = mimeBase === 'image/png' ? 'png' : mimeBase === 'image/webp' ? 'webp' : 'jpg'
    const path = `${userId}/${tripId}.${ext}`

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY)
    const { error } = await serviceClient.storage
      .from('trip-images')
      .upload(path, buffer, { upsert: true, contentType: mimeBase })

    if (error) {
      console.error('Storage upload error (cover):', error)
      return null
    }

    const { data: { publicUrl } } = serviceClient.storage
      .from('trip-images')
      .getPublicUrl(path)

    return publicUrl
  } catch (err) {
    console.error('storeCoverImage failed:', err)
    return null
  }
}
