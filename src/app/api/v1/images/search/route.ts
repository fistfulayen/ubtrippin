/**
 * GET /api/v1/images/search?q=tokyo — Search for cover images via Unsplash
 *
 * Server-side proxy for Unsplash photo search. Keeps the API key server-side
 * and returns a clean, minimal shape for client consumption.
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'

interface UnsplashPhoto {
  urls: {
    regular: string
    thumb: string
  }
  user: {
    name: string
    links: {
      html: string
    }
  }
}

interface UnsplashSearchResponse {
  results: UnsplashPhoto[]
  total: number
  total_pages: number
}

export async function GET(request: NextRequest) {
  // 1. Authenticate
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  // 2. Rate limit
  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  // 3. Validate query param
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')

  if (!q || q.trim().length === 0) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: '"q" query parameter is required.' } },
      { status: 400 }
    )
  }

  if (q.length > 200) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: '"q" must be 200 characters or fewer.' } },
      { status: 400 }
    )
  }

  // 4. Check API key is configured
  const accessKey = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY
  if (!accessKey) {
    console.error('[v1/images/search] NEXT_PUBLIC_UNSPLASH_ACCESS_KEY is not set')
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Image search is not configured.' } },
      { status: 500 }
    )
  }

  // 5. Proxy to Unsplash
  const unsplashUrl = new URL('https://api.unsplash.com/search/photos')
  unsplashUrl.searchParams.set('query', q.trim())
  unsplashUrl.searchParams.set('per_page', '9')
  unsplashUrl.searchParams.set('orientation', 'landscape')

  let unsplashData: UnsplashSearchResponse
  try {
    const res = await fetch(unsplashUrl.toString(), {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
      },
      next: { revalidate: 300 }, // cache for 5 min — same query returns same results
    })

    if (!res.ok) {
      console.error('[v1/images/search] Unsplash API error:', res.status, await res.text())
      return NextResponse.json(
        { error: { code: 'internal_error', message: 'Image search request failed.' } },
        { status: 502 }
      )
    }

    unsplashData = await res.json() as UnsplashSearchResponse
  } catch (err) {
    console.error('[v1/images/search] Fetch error:', err)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Image search request failed.' } },
      { status: 502 }
    )
  }

  // 6. Map to minimal shape
  const photos = (unsplashData.results ?? []).map((photo) => ({
    url: photo.urls.regular,
    thumb: photo.urls.thumb,
    credit: {
      name: photo.user.name,
      link: photo.user.links.html,
    },
  }))

  return NextResponse.json({
    data: photos,
    meta: {
      query: q.trim(),
      count: photos.length,
    },
  })
}
