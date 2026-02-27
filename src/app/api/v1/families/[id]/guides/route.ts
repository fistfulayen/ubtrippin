import { NextRequest, NextResponse } from 'next/server'
import { createSecretClient } from '@/lib/supabase/service'
import { requireFamilyAccess } from '../_lib'

type Params = { params: Promise<{ id: string }> }

interface ProfileRow {
  id: string
  full_name: string | null
  email: string | null
}

type GuideRow = {
  id: string
  user_id: string
  city: string
  country: string | null
  country_code: string | null
  is_public: boolean
  share_token: string | null
  cover_image_url: string | null
  entry_count: number
  created_at: string
  updated_at: string
}

type GuideEntryRow = Record<string, unknown> & {
  id: string
  guide_id: string
  user_id: string
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { id: familyId } = await params
  const access = await requireFamilyAccess(familyId)
  if ('response' in access) return access.response

  const memberUserIds = Array.from(new Set(access.ctx.members.map((member) => member.user_id)))

  const { data: guideRows, error: guidesError } = await access.ctx.supabase
    .from('city_guides')
    .select('*')
    .in('user_id', memberUserIds)
    .order('updated_at', { ascending: false })

  if (guidesError) {
    console.error('[v1/families/:id/guides GET] guide lookup failed', guidesError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to load family guides.' } },
      { status: 500 }
    )
  }

  const guides = (guideRows ?? []) as GuideRow[]
  const guideIds = guides.map((guide) => guide.id)

  const { data: entryRows, error: entriesError } = guideIds.length
    ? await access.ctx.supabase
        .from('guide_entries')
        .select('*')
        .in('guide_id', guideIds)
        .order('created_at', { ascending: false })
    : { data: [], error: null }

  if (entriesError) {
    console.error('[v1/families/:id/guides GET] entries lookup failed', entriesError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to load guide entries.' } },
      { status: 500 }
    )
  }

  const secret = createSecretClient()
  const { data: profileRows } = memberUserIds.length
    ? await secret
        .from('profiles')
        .select('id, full_name, email')
        .in('id', memberUserIds)
    : { data: [] }

  const nameByUserId = new Map<string, string | null>(
    ((profileRows ?? []) as ProfileRow[]).map((row) => [row.id, row.full_name || row.email || null])
  )

  const entriesByGuideId = new Map<string, GuideEntryRow[]>()
  for (const entry of (entryRows ?? []) as GuideEntryRow[]) {
    const explicitAuthorId = typeof entry.author_id === 'string' ? entry.author_id : null
    const explicitAuthorName =
      typeof entry.author_name === 'string' && entry.author_name.trim() ? entry.author_name : null
    const fallbackAuthorId = explicitAuthorId || entry.user_id

    const enriched = {
      ...entry,
      author_id: fallbackAuthorId,
      author_name: explicitAuthorName || nameByUserId.get(fallbackAuthorId) || null,
    }

    const existing = entriesByGuideId.get(entry.guide_id)
    if (existing) {
      existing.push(enriched)
    } else {
      entriesByGuideId.set(entry.guide_id, [enriched])
    }
  }

  const data = guides.map((guide) => ({
    ...guide,
    owner: {
      user_id: guide.user_id,
      full_name: nameByUserId.get(guide.user_id) ?? null,
    },
    owner_name: nameByUserId.get(guide.user_id) ?? null,
    entries: entriesByGuideId.get(guide.id) ?? [],
  }))

  return NextResponse.json({
    data,
    meta: {
      count: data.length,
      family_member_count: memberUserIds.length,
    },
  })
}
