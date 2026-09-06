import { createClient } from '@supabase/supabase-js'
import { detectImageMime } from '@/lib/images/image-bytes'
import { getHeaderValue, requestPublicUrl } from '@/lib/security/public-http'

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
    const res = await requestPublicUrl(imageUrl, {
      headers: { 'User-Agent': 'UBTRIPPIN/1.0' },
      maxResponseBytes: 5 * 1024 * 1024,
      maxRedirects: 3,
      timeoutMs: 10_000,
    })
    if (res.status < 200 || res.status >= 300) {
      console.error('Failed to fetch cover image:', res.status, imageUrl)
      return null
    }

    const contentType = getHeaderValue(res.headers, 'content-type')
    const mimeBase = contentType.split(';')[0].trim()
    const detectedMime = detectImageMime(res.body)
    if (!detectedMime || detectedMime !== mimeBase.replace('image/jpg', 'image/jpeg')) {
      console.warn('Cover image content does not match its declared MIME type')
      return null
    }

    const ext = detectedMime === 'image/png' ? 'png' : detectedMime === 'image/webp' ? 'webp' : detectedMime === 'image/gif' ? 'gif' : 'jpg'
    const path = `${userId}/${tripId}.${ext}`

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY)
    const { error } = await serviceClient.storage
      .from('trip-images')
      .upload(path, res.body, { upsert: true, contentType: detectedMime })

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
