/**
 * GET /api/v1/images/search?q=<query>&count=<n>
 * 
 * Search for images via Brave Image Search.
 * Used by the trip cover image picker.
 * Requires authentication (Supabase session).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { searchBraveImageResults } from '@/lib/images/brave-image-search'

export async function GET(request: NextRequest) {
  // Auth check — user must be logged in
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Not authenticated.' } },
      { status: 401 }
    )
  }

  const query = request.nextUrl.searchParams.get('q')
  if (!query || query.trim().length === 0) {
    return NextResponse.json(
      { error: { code: 'bad_request', message: 'Query parameter "q" is required.' } },
      { status: 400 }
    )
  }

  const count = Math.min(
    parseInt(request.nextUrl.searchParams.get('count') || '8', 10),
    20
  )

  const results = await searchBraveImageResults(query.trim(), count)

  return NextResponse.json({ data: results })
}
