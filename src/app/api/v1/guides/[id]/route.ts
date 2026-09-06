/**
 * GET    /api/v1/guides/:id  — Get a guide with its entries (?format=json|md)
 * DELETE /api/v1/guides/:id  — Delete a guide
 * PATCH  /api/v1/guides/:id  — Update guide metadata (visibility, city, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { createUserScopedClient } from '@/lib/supabase/user-scoped'
import { isValidUUID } from '@/lib/validation'
import { nanoid } from 'nanoid'
import type { CityGuide, GuideEntry } from '@/types/database'
import { PUBLIC_GUIDE_MIN_ENTRIES, isGuideVisibility } from '@/lib/guides/public'

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

  const supabase = await createUserScopedClient(auth.userId)

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

  const rawEntries = (entries ?? []) as Array<Record<string, unknown> & GuideEntry>
  const authorIds = Array.from(
    new Set(
      rawEntries
        .map((entry) =>
          typeof entry.author_id === 'string' && entry.author_id
            ? entry.author_id
            : entry.user_id
        )
        .filter((authorId): authorId is string => typeof authorId === 'string' && authorId.length > 0)
    )
  )

  const { data: authorProfiles } = authorIds.length
    ? await supabase
        .from('shared_profiles')
        .select('id, full_name')
        .in('id', authorIds)
    : { data: [] }

  const authorNameById = new Map<string, string | null>(
    ((authorProfiles ?? []) as Array<{ id: string; full_name?: string | null }>)
      .map((profile) => [profile.id, profile.full_name || null])
  )

  const entriesWithAuthor = rawEntries.map((entry) => {
    const authorId =
      typeof entry.author_id === 'string' && entry.author_id
        ? entry.author_id
        : entry.user_id
    const explicitAuthorName =
      typeof entry.author_name === 'string' && entry.author_name.trim()
        ? entry.author_name
        : null

    return {
      ...entry,
      author_id: authorId,
      author_name: explicitAuthorName || authorNameById.get(authorId) || null,
    }
  })

  const format = new URL(request.url).searchParams.get('format') ?? 'json'

  if (format === 'md') {
    const markdown = guideToMarkdown(guide as CityGuide, entriesWithAuthor as GuideEntry[])
    return new NextResponse(markdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `inline; filename="${guide.city}-guide.md"`,
      },
    })
  }

  // Default: JSON
  return NextResponse.json({
    data: { ...(guide as CityGuide), entries: entriesWithAuthor },
    meta: { entry_count: entriesWithAuthor.length },
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

  const supabase = await createUserScopedClient(auth.userId)

  const updates: Record<string, unknown> = {}
  if (body.city !== undefined) updates.city = body.city
  if (body.country !== undefined) updates.country = body.country
  if (body.country_code !== undefined) updates.country_code = body.country_code

  const nextVisibility = isGuideVisibility(body.visibility)
    ? body.visibility
    : typeof body.is_public === 'boolean'
      ? (body.is_public ? 'public' : 'private')
      : null

  if (nextVisibility) {
    if (nextVisibility === 'public') {
      const [{ data: existingGuide }, { data: profile }] = await Promise.all([
        supabase
          .from('city_guides')
          .select('entry_count, share_token')
          .eq('id', id)
          .eq('user_id', auth.userId)
          .single(),
        supabase
          .from('profiles')
          .select('public_username')
          .eq('id', auth.userId)
          .single(),
      ])

      const currentGuide = existingGuide as { entry_count: number; share_token: string | null } | null
      const currentProfile = profile as { public_username: string | null } | null

      if (!currentGuide || !currentProfile?.public_username) {
        return NextResponse.json(
          {
            error: {
              code: 'public_username_required',
              message: 'Set a public username in Settings to share guides publicly.',
            },
          },
          { status: 400 }
        )
      }

      if ((currentGuide.entry_count ?? 0) < PUBLIC_GUIDE_MIN_ENTRIES) {
        return NextResponse.json(
          {
            error: {
              code: 'not_enough_entries',
              message: `Add at least ${PUBLIC_GUIDE_MIN_ENTRIES} places to publish this guide (currently ${currentGuide.entry_count ?? 0}).`,
            },
          },
          { status: 400 }
        )
      }

      updates.visibility = 'public'
      updates.public_username = currentProfile.public_username
      if (!currentGuide.share_token) {
        updates.share_token = nanoid(21)
      }
    } else {
      updates.visibility = 'private'
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

  const supabase = await createUserScopedClient(auth.userId)

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
