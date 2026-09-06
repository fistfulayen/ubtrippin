const TRUSTED_REMOTE_IMAGE_HOSTS = new Set(['images.unsplash.com', 'plus.unsplash.com'])

export function normalizeCoverImageUrl(value: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(value.trim())
  } catch {
    return null
  }

  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null

  const hostname = parsed.hostname.toLowerCase()
  if (TRUSTED_REMOTE_IMAGE_HOSTS.has(hostname)) return parsed.toString()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return null

  try {
    const storageOrigin = new URL(supabaseUrl).origin
    if (
      parsed.origin === storageOrigin &&
      parsed.pathname.startsWith('/storage/v1/object/public/trip-images/')
    ) {
      return parsed.toString()
    }
  } catch {
    return null
  }

  return null
}
