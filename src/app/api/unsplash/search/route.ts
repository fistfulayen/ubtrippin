import { NextRequest, NextResponse } from 'next/server'

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')
  if (!query) {
    return NextResponse.json({ error: 'Missing query' }, { status: 400 })
  }

  if (!UNSPLASH_ACCESS_KEY) {
    return NextResponse.json({ error: 'Unsplash not configured' }, { status: 500 })
  }

  const params = new URLSearchParams({
    query: `${query} travel`,
    orientation: 'landscape',
    per_page: '8',
  })

  const response = await fetch(
    `https://api.unsplash.com/search/photos?${params}`,
    {
      headers: {
        Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
      },
    }
  )

  if (!response.ok) {
    return NextResponse.json({ error: 'Unsplash API error' }, { status: 502 })
  }

  const data = await response.json()
  return NextResponse.json({
    results: data.results.map((r: { urls: { regular: string; small: string }; alt_description: string | null; user: { name: string } }) => ({
      urls: { regular: r.urls.regular, small: r.urls.small },
      alt_description: r.alt_description,
      user: { name: r.user.name },
    })),
  })
}
