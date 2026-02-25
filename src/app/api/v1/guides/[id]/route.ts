/**
 * GET    /api/v1/guides/:id  — Get a guide with its entries (?format=json|md)
 * DELETE /api/v1/guides/:id  — Delete a guide
 * PATCH  /api/v1/guides/:id  — Update guide metadata (is_public, city, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { createSecretClient } from '@/lib/supabase/service'
import { isValidUUID } from '@/lib/validation'
import { nanoid } from 'nanoid'
import type { CityGuide, GuideEntry } from '@/types/database'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  const { id } = await params
  if (!isValidUUID(id)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Guide ID must be a valid UUID.' } },
      { status: 400 }
    )
  }

  const supabase = createSecretClient()

  const { data: guide, error: guideError } = await supabase
    .from('city_guides')
    .select('*')
    .eq('id', id)
    .eq('user_id', auth.userId)
    .single()

  if (guideError || !guide) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Guide not found.' } },
      { status: 404 }
    )
  }

  const { data: entries, error: entriesError } = await supabase
    .from('guide_entries')
    .select('*')
    .eq('guide_id', id)
    .order('category', { ascending: true })
    .order('created_at', { ascending: false })

  if (entriesError) {
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch entries.' } },
      { status: 500 }
    )
  }

  const format = new URL(request.url).searchParams.get('format') ?? 'json'

  if (format === 'md') {
    const markdown = guideToMarkdown(guide as CityGuide, (entries ?? []) as GuideEntry[])
    return new NextResponse(markdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `inline; filename="${guide.city}-guide.md"`,
      },
    })
  }

  // Default: JSON
  return NextResponse.json({
    data: { ...(guide as CityGuide), entries: entries ?? [] },
    meta: { entry_count: (entries ?? []).length },
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  const { id } = await params
  if (!isValidUUID(id)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Guide ID must be a valid UUID.' } },
      { status: 400 }
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } },
      { status: 400 }
    )
  }

  const supabase = createSecretClient()

  // If making public, ensure share_token exists
  const updates: Record<string, unknown> = {}
  if (body.city !== undefined) updates.city = body.city
  if (body.country !== undefined) updates.country = body.country
  if (body.country_code !== undefined) updates.country_code = body.country_code

  if (typeof body.is_public === 'boolean') {
    updates.is_public = body.is_public
    if (body.is_public) {
      const { data: existing } = await supabase
        .from('city_guides')
        .select('share_token')
        .eq('id', id)
        .eq('user_id', auth.userId)
        .single()
      if (!existing?.share_token) {
        updates.share_token = nanoid(21)
      }
    }
  }

  const { data: guide, error } = await supabase
    .from('city_guides')
    .update(updates)
    .eq('id', id)
    .eq('user_id', auth.userId)
    .select('*')
    .single()

  if (error || !guide) {
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to update guide.' } },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: guide })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  const { id } = await params
  if (!isValidUUID(id)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Guide ID must be a valid UUID.' } },
      { status: 400 }
    )
  }

  const supabase = createSecretClient()

  const { error } = await supabase
    .from('city_guides')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.userId)

  if (error) {
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to delete guide.' } },
      { status: 500 }
    )
  }

  return new NextResponse(null, { status: 204 })
}

// ---------------------------------------------------------------------------
// Markdown formatter
// ---------------------------------------------------------------------------

function guideToMarkdown(guide: CityGuide, entries: GuideEntry[]): string {
  const flag = guide.country_code
    ? String.fromCodePoint(
        ...guide.country_code
          .toUpperCase()
          .split('')
          .map((c: string) => 0x1f1e6 + c.charCodeAt(0) - 65)
      )
    : ''

  const lines: string[] = []
  lines.push(`# ${flag} ${guide.city}${guide.country ? ` — ${guide.country}` : ''}`)
  lines.push(``)
  lines.push(`*${entries.filter(e => e.status === 'visited').length} places · personal guide*`)
  lines.push(``)

  // Group by category
  const visited = entries.filter(e => e.status === 'visited')
  const grouped = visited.reduce<Record<string, GuideEntry[]>>((acc, e) => {
    if (!acc[e.category]) acc[e.category] = []
    acc[e.category].push(e)
    return acc
  }, {})

  for (const [category, catEntries] of Object.entries(grouped)) {
    lines.push(`## ${category}`)
    lines.push(``)
    for (const entry of catEntries) {
      lines.push(`### ${entry.name}`)
      if (entry.rating) {
        lines.push(`Rating: ${'★'.repeat(entry.rating)}${'☆'.repeat(5 - entry.rating)}`)
      }
      if (entry.description) lines.push(``)
      if (entry.description) lines.push(entry.description)
      if (entry.address) lines.push(``)
      if (entry.address) lines.push(`📍 ${entry.address}`)
      if (entry.website_url) lines.push(`🔗 ${entry.website_url}`)
      if (entry.recommended_by) lines.push(`*Recommended by ${entry.recommended_by}*`)
      lines.push(``)
    }
  }

  // To Try
  const toTry = entries.filter(e => e.status === 'to_try')
  if (toTry.length > 0) {
    lines.push(`## 🔖 To Try`)
    lines.push(``)
    for (const entry of toTry) {
      lines.push(`- **${entry.name}** (${entry.category})${entry.description ? ' — ' + entry.description : ''}${entry.recommended_by ? ` · via ${entry.recommended_by}` : ''}`)
    }
    lines.push(``)
  }

  return lines.join('\n')
}
