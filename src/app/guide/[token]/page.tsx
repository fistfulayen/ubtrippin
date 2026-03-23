import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Globe, Star, MapPin, ExternalLink, Bookmark, Lock } from 'lucide-react'
import type { Metadata } from 'next'
import type { CityGuide, GuideEntry } from '@/types/database'
import { GuideMapSection } from '@/components/maps/guide-map-section'

interface Props {
  params: Promise<{ token: string }>
  searchParams: Promise<{ view?: string }>
}

type GuideEntryWithAuthor = GuideEntry & {
  author_id?: string | null
  author_name?: string | null
}

function toCoordinate(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
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

function buildFlag(countryCode: string | null): string | null {
  if (!countryCode) return null
  return String.fromCodePoint(
    ...countryCode
      .toUpperCase()
      .split('')
      .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  )
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const supabase = await createClient()

  const { data: guide } = await supabase
    .from('city_guides')
    .select('city, country, country_code, public_username, entry_count')
    .eq('share_token', token)
    .eq('visibility', 'public')
    .single()

  if (!guide) return {}

  const flag = buildFlag(guide.country_code ?? null)
  const title = `${flag ? flag + ' ' : ''}${guide.city} City Guide${guide.public_username ? ` by @${guide.public_username}` : ''}`
  const description = `A personal city guide for ${guide.city}${guide.country ? ', ' + guide.country : ''} with ${guide.entry_count ?? 0} recommended places. Created by a real traveler on UBTRIPPIN.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
    },
  }
}

export default async function PublicGuidePage({ params, searchParams }: Props) {
  const { token } = await params
  const { view } = await searchParams

  const supabase = await createClient()

  const { data: guide, error } = await supabase
    .from('city_guides')
    .select('*')
    .eq('share_token', token)
    .eq('visibility', 'public')
    .single()

  if (error || !guide) notFound()

  const g = guide as CityGuide

  // Determine auth state — server-side, no extra round-trip cost
  const { data: { user } } = await supabase.auth.getUser()
  const isAuthenticated = !!user

  const { data: allEntries } = await supabase
    .from('guide_entries')
    .select('*')
    .eq('guide_id', g.id)
    .order('created_at', { ascending: false })

  const entries = (allEntries ?? []) as GuideEntryWithAuthor[]
  const hasMultipleAuthors =
    new Set(entries.map((entry) => entry.author_id || entry.user_id)).size > 1

  const mapEntries = entries
    .map((entry) => {
      const latitude = toCoordinate(entry.latitude)
      const longitude = toCoordinate(entry.longitude)
      if (latitude === null || longitude === null) return null
      return {
        id: entry.id,
        name: entry.name,
        category: entry.category,
        latitude,
        longitude,
      }
    })
    .filter((entry): entry is { id: string; name: string; category: string; latitude: number; longitude: number } => entry !== null)
  const hasMapEntries = mapEntries.length > 0
  const showMapView = hasMapEntries && view === 'map'

  // Group visited entries by category; separate to_try section
  const visited = entries.filter((e) => e.status === 'visited')
  const toTry = entries.filter((e) => e.status === 'to_try')

  const grouped = visited.reduce<Record<string, GuideEntry[]>>((acc, entry) => {
    if (!acc[entry.category]) acc[entry.category] = []
    acc[entry.category].push(entry)
    return acc
  }, {})

  const flag = buildFlag(g.country_code)

  // For non-authenticated users: first 3 entries visible, rest blurred
  const PREVIEW_LIMIT = 3
  const allFlat = [...visited, ...toTry]
  const visibleEntries = isAuthenticated ? allFlat : allFlat.slice(0, PREVIEW_LIMIT)
  const hiddenCount = isAuthenticated ? 0 : Math.max(0, allFlat.length - PREVIEW_LIMIT)

  // Redirect URL for sign-up CTA
  const redirectParam = encodeURIComponent(`/guide/${token}`)

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      {/* Nav bar */}
      <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 flex items-center justify-between h-14">
          <Link href="/" className="font-bold text-gray-900 tracking-tight">
            UBTRIPPIN
          </Link>
          <Link
            href="/"
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Start your guide →
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-10 space-y-10">
        {/* Hero */}
        {g.cover_image_url && (
          <img
            src={g.cover_image_url}
            alt={g.city}
            className="w-full h-56 object-cover rounded-2xl"
          />
        )}

        <div>
          <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
            {flag && <span>{flag}</span>}
            {g.city}
          </h1>
          {g.country && <p className="text-gray-500 mt-1 text-lg">{g.country}</p>}
          <p className="text-gray-400 mt-1 text-sm flex items-center gap-1">
            <Globe className="h-3.5 w-3.5" />
            {visited.length} places · personal guide
          </p>
          {g.public_username ? (
            <p className="mt-2 text-sm font-medium text-slate-600">@{g.public_username}</p>
          ) : null}
        </div>

        {/* Map/List toggle — only shown to authenticated users in map view */}
        {isAuthenticated && hasMapEntries && (
          <div className="flex gap-2">
            <Link
              href={`/guide/${token}`}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                !showMapView
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              List
            </Link>
            <Link
              href={`/guide/${token}?view=map`}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                showMapView
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              Map
            </Link>
          </div>
        )}

        {/* ── AUTHENTICATED: full guide ── */}
        {isAuthenticated && (
          <>
            {showMapView ? (
              <section className="space-y-3">
                <h2 className="text-xl font-semibold text-gray-900">Map View</h2>
                <GuideMapSection entries={mapEntries} />
              </section>
            ) : (
              <>
                {Object.entries(grouped).map(([category, catEntries]) => (
                  <section key={category}>
                    <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900 mb-5 pb-2 border-b border-gray-100">
                      <span>{CATEGORY_ICONS[category] ?? '📍'}</span>
                      {category}
                    </h2>
                    <div className="space-y-4">
                      {catEntries.map((entry) => (
                        <PublicEntryCard key={entry.id} entry={entry} showAuthorAttribution={hasMultipleAuthors} />
                      ))}
                    </div>
                  </section>
                ))}

                {toTry.length > 0 && (
                  <section>
                    <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900 mb-5 pb-2 border-b border-gray-100">
                      <Bookmark className="h-5 w-5 text-amber-500" />
                      On the list
                    </h2>
                    <div className="space-y-4">
                      {toTry.map((entry) => (
                        <PublicEntryCard key={entry.id} entry={entry} showAuthorAttribution={hasMultipleAuthors} />
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}

        {/* ── NON-AUTHENTICATED: preview + blur wall ── */}
        {!isAuthenticated && (
          <div className="space-y-4">
            {/* First 3 entries — name + category only, no notes */}
            {visibleEntries.map((entry) => (
              <PreviewEntryCard key={entry.id} entry={entry} />
            ))}

            {/* Blurred placeholder cards + CTA overlay */}
            {hiddenCount > 0 && (
              <div className="relative">
                {/* Ghost cards underneath the blur */}
                <div className="space-y-4 blur-sm pointer-events-none select-none" aria-hidden="true">
                  {Array.from({ length: Math.min(hiddenCount, 4) }).map((_, i) => (
                    <BlurredPlaceholderCard key={i} />
                  ))}
                </div>

                {/* CTA overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-white via-white/90 to-transparent rounded-xl px-6 py-10 text-center">
                  <div className="bg-white rounded-2xl shadow-lg border border-gray-100 px-8 py-8 max-w-sm w-full space-y-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50 mx-auto">
                      <Lock className="h-5 w-5 text-indigo-600" />
                    </div>
                    <p className="font-semibold text-gray-900 text-lg">
                      {hiddenCount} more place{hiddenCount !== 1 ? 's' : ''} in this guide
                    </p>
                    <p className="text-gray-500 text-sm">
                      Sign up free to see the full guide — no credit card required.
                    </p>
                    <Link
                      href={`/login?redirect=${redirectParam}`}
                      className="block w-full rounded-xl bg-indigo-600 text-white font-semibold px-6 py-3 hover:bg-indigo-700 transition-colors text-sm"
                    >
                      Sign up free to see the full guide
                    </Link>
                    <p className="text-xs text-gray-400">
                      Already have an account?{' '}
                      <Link href={`/login?redirect=${redirectParam}`} className="text-indigo-600 hover:underline">
                        Log in
                      </Link>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* If guide has ≤3 entries, just show the sign-up CTA normally */}
            {hiddenCount === 0 && allFlat.length > 0 && (
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-6 text-center space-y-3">
                <p className="font-semibold text-gray-900">Like what you see?</p>
                <p className="text-gray-500 text-sm">Create your own city guide — free forever.</p>
                <Link
                  href={`/login?redirect=${redirectParam}`}
                  className="inline-block rounded-xl bg-indigo-600 text-white font-semibold px-6 py-3 hover:bg-indigo-700 transition-colors text-sm"
                >
                  Get started free →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Footer CTA */}
        <div className="rounded-2xl bg-indigo-600 text-white p-8 text-center space-y-4">
          <p className="text-xl font-bold">Build your own city guide</p>
          <p className="text-indigo-200 text-sm">
            UBTRIPPIN turns your travel knowledge into beautiful, shareable guides.
            Your agent can add places for you automatically.
          </p>
          <Link
            href="/"
            className="inline-block rounded-xl bg-white text-indigo-700 font-semibold px-6 py-3 hover:bg-indigo-50 transition-colors text-sm"
          >
            Start for free →
          </Link>
        </div>
      </main>
    </div>
  )
}

// Full card for authenticated users
function PublicEntryCard({
  entry,
  showAuthorAttribution,
}: {
  entry: GuideEntryWithAuthor
  showAuthorAttribution: boolean
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 text-lg">{entry.name}</h3>
            {entry.rating && (
              <span className="flex items-center gap-0.5">
                {Array.from({ length: entry.rating }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                ))}
              </span>
            )}
          </div>

          {entry.description && (
            <p className="mt-2 text-gray-600 leading-relaxed">{entry.description}</p>
          )}

          <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-400">
            {showAuthorAttribution && (
              <span className="text-gray-500">Added by {entry.author_name || 'Traveler'}</span>
            )}
            {entry.address && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
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
                <ExternalLink className="h-3.5 w-3.5" />
                Website
              </a>
            )}
            {entry.recommended_by && (
              <span className="text-gray-400 italic">via {entry.recommended_by}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Stripped-down card for unauthenticated preview — name + category only
function PreviewEntryCard({ entry }: { entry: GuideEntryWithAuthor }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <span className="text-xl">{CATEGORY_ICONS[entry.category] ?? '📍'}</span>
        <div>
          <p className="font-semibold text-gray-900">{entry.name}</p>
          <p className="text-sm text-gray-400">{entry.category}</p>
        </div>
      </div>
    </div>
  )
}

// Placeholder card shown blurred behind the CTA
function BlurredPlaceholderCard() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gray-200" />
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          <div className="h-3 bg-gray-100 rounded w-1/3" />
        </div>
      </div>
    </div>
  )
}
