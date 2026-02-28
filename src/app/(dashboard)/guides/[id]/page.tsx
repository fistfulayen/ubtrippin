import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Plus,
  Globe,
  Lock,
  Star,
  ExternalLink,
  MapPin,
  Bookmark,
  CheckCircle2,
  FileText,
  ImagePlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CityGuide, GuideEntry } from '@/types/database'
import { GuideShareToggle } from './guide-share-toggle'
import { EntryActions } from './entry-actions'
import { DeleteGuideButton } from './delete-guide-button'
import { refreshGuideCoverImage } from '../actions'

interface GuidePageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ filter?: string }>
}

type GuideEntryWithAuthor = GuideEntry & {
  author_id?: string | null
  author_name?: string | null
}

const CATEGORY_ICONS: Record<string, string> = {
  Coffee: '☕',
  Restaurants: '🍽️',
  Hotels: '🏨',
  'Bars & Wine': '🍷',
  'Museums & Galleries': '🏛️',
  Shopping: '🛍️',
  'Parks & Nature': '🌿',
  Activities: '🎯',
  'Music & Nightlife': '🎵',
  'Running & Sports': '🏃',
  Markets: '🧺',
  Architecture: '🏛️',
  'Hidden Gems': '💎',
}

export default async function GuidePage({ params, searchParams }: GuidePageProps) {
  const { id } = await params
  const { filter } = await searchParams

  const supabase = await createClient()

  const { data: guide, error } = await supabase
    .from('city_guides')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !guide) notFound()

  const g = guide as CityGuide

  const { data: allEntries } = await supabase
    .from('guide_entries')
    .select('*')
    .eq('guide_id', id)
    .order('created_at', { ascending: false })

  const rawEntries = (allEntries ?? []) as GuideEntryWithAuthor[]
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

  const authorNameById = new Map<string, string | null>()
  if (authorIds.length > 0) {
    const { data: authorProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', authorIds)

    for (const profile of (authorProfiles ?? []) as Array<{ id: string; full_name?: string | null; email?: string | null }>) {
      authorNameById.set(profile.id, profile.full_name || profile.email || null)
    }
  }

  const entries = rawEntries.map((entry) => {
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

  // Split visited vs to_try
  const showToTry = filter === 'to-try'
  const displayEntries = showToTry
    ? entries.filter((e) => e.status === 'to_try')
    : entries.filter((e) => e.status === 'visited')

  // Group by category
  const grouped = displayEntries.reduce<Record<string, GuideEntry[]>>((acc, entry) => {
    if (!acc[entry.category]) acc[entry.category] = []
    acc[entry.category].push(entry)
    return acc
  }, {})

  const toTryCount = entries.filter((e) => e.status === 'to_try').length
  const visitedCount = entries.filter((e) => e.status === 'visited').length
  const hasMultipleAuthors =
    new Set(entries.map((entry) => entry.author_id || entry.user_id)).size > 1

  const flag = g.country_code
    ? String.fromCodePoint(
        ...g.country_code
          .toUpperCase()
          .split('')
          .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
      )
    : null

  const shareUrl = g.share_token
    ? `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://ubtrippin.xyz'}/guide/${g.share_token}`
    : null
  const refreshCoverAction = refreshGuideCoverImage.bind(null, g.id)

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        href="/guides"
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to guides
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            {flag && <span className="text-2xl">{flag}</span>}
            {g.city}
          </h1>
          {g.country && <p className="text-gray-500 mt-1">{g.country}</p>}
          <p className="text-sm text-gray-400 mt-1">
            {entries.length} {entries.length === 1 ? 'place' : 'places'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Share toggle */}
          <GuideShareToggle
            guideId={g.id}
            isPublic={g.is_public}
            shareUrl={shareUrl}
          />

          {/* Export links */}
          <a
            href={`/api/v1/guides/${g.id}?format=md`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Markdown
            </Button>
          </a>

          {/* Add entry */}
          <Link href={`/guides/${g.id}/add`}>
            <Button size="sm">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add place
            </Button>
          </Link>

          <form action={refreshCoverAction}>
            <Button size="sm" variant="outline" type="submit">
              <ImagePlus className="h-3.5 w-3.5 mr-1.5" />
              Cover image
            </Button>
          </form>

          <DeleteGuideButton guideId={g.id} />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <Link
          href={`/guides/${id}`}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            !showToTry
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <CheckCircle2 className="inline h-3.5 w-3.5 mr-1.5 mb-0.5" />
          Visited ({visitedCount})
        </Link>
        <Link
          href={`/guides/${id}?filter=to-try`}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            showToTry
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Bookmark className="inline h-3.5 w-3.5 mr-1.5 mb-0.5" />
          To Try ({toTryCount})
        </Link>
      </div>

      {/* Entries */}
      {displayEntries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <MapPin className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500">
            {showToTry
              ? 'No places on your "to try" list yet.'
              : 'No visited places yet.'}
          </p>
          <Link href={`/guides/${id}/add`} className="mt-4 inline-block">
            <Button size="sm" variant="outline">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add a place
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([category, catEntries]) => (
            <section key={category}>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
                <span>{CATEGORY_ICONS[category] ?? '📍'}</span>
                {category}
                <span className="text-sm font-normal text-gray-400">({catEntries.length})</span>
              </h2>
              <div className="space-y-3">
                {catEntries.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    guideId={id}
                    showAuthorAttribution={hasMultipleAuthors}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Share info */}
      {g.is_public && shareUrl && (
        <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-4">
          <div className="flex items-center gap-2 text-indigo-800 text-sm font-medium mb-1">
            <Globe className="h-4 w-4" />
            This guide is public
          </div>
          <p className="text-sm text-indigo-700">
            Share link:{' '}
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:no-underline font-mono text-xs"
            >
              {shareUrl}
            </a>
          </p>
        </div>
      )}
    </div>
  )
}

function EntryCard({
  entry,
  guideId,
  showAuthorAttribution,
}: {
  entry: GuideEntryWithAuthor
  guideId: string
  showAuthorAttribution: boolean
}) {
  return (
    <div
      className={`rounded-xl border bg-white p-4 ${
        entry.status === 'to_try'
          ? 'border-dashed border-gray-300'
          : 'border-gray-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900">{entry.name}</h3>
            {entry.status === 'to_try' && (
              <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
                <Bookmark className="h-3 w-3" />
                To try
              </span>
            )}
            {entry.rating && (
              <span className="inline-flex items-center gap-0.5 text-xs text-amber-600">
                {Array.from({ length: entry.rating }).map((_, i) => (
                  <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                ))}
              </span>
            )}
          </div>

          {entry.description && (
            <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{entry.description}</p>
          )}

          <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-400">
            {showAuthorAttribution && (
              <span className="text-gray-500">Added by {entry.author_name || 'Traveler'}</span>
            )}
            {entry.address && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {entry.address}
              </span>
            )}
            {entry.website_url && (
              <a
                href={entry.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-indigo-600"
              >
                <ExternalLink className="h-3 w-3" />
                Website
              </a>
            )}
            {entry.recommended_by && (
              <span className="text-gray-400">
                via {entry.recommended_by}
              </span>
            )}
          </div>

          {entry.tags && entry.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {entry.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <EntryActions entry={entry} guideId={guideId} />
      </div>
    </div>
  )
}

// Re-export for type use
export type { CityGuide, GuideEntry }
