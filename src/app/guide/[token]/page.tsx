import { createSecretClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Globe, Star, MapPin, ExternalLink, Bookmark } from 'lucide-react'
import type { CityGuide, GuideEntry } from '@/types/database'

interface Props {
  params: Promise<{ token: string }>
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

export default async function PublicGuidePage({ params }: Props) {
  const { token } = await params

  const supabase = createSecretClient()

  const { data: guide, error } = await supabase
    .from('city_guides')
    .select('*')
    .eq('share_token', token)
    .eq('is_public', true)
    .single()

  if (error || !guide) notFound()

  const g = guide as CityGuide

  const { data: allEntries } = await supabase
    .from('guide_entries')
    .select('*')
    .eq('guide_id', g.id)
    .order('created_at', { ascending: false })

  const entries = (allEntries ?? []) as GuideEntry[]

  // Group visited entries by category; separate to_try section
  const visited = entries.filter((e) => e.status === 'visited')
  const toTry = entries.filter((e) => e.status === 'to_try')

  const grouped = visited.reduce<Record<string, GuideEntry[]>>((acc, entry) => {
    if (!acc[entry.category]) acc[entry.category] = []
    acc[entry.category].push(entry)
    return acc
  }, {})

  const flag = g.country_code
    ? String.fromCodePoint(
        ...g.country_code
          .toUpperCase()
          .split('')
          .map((c) => 0x1f1e0 + c.charCodeAt(0) - 65)
      )
    : null

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
          // eslint-disable-next-line @next/next/no-img-element
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
        </div>

        {/* Visited entries by category */}
        {Object.entries(grouped).map(([category, catEntries]) => (
          <section key={category}>
            <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900 mb-5 pb-2 border-b border-gray-100">
              <span>{CATEGORY_ICONS[category] ?? '📍'}</span>
              {category}
            </h2>
            <div className="space-y-4">
              {catEntries.map((entry) => (
                <PublicEntryCard key={entry.id} entry={entry} />
              ))}
            </div>
          </section>
        ))}

        {/* To Try (if any) */}
        {toTry.length > 0 && (
          <section>
            <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900 mb-5 pb-2 border-b border-gray-100">
              <Bookmark className="h-5 w-5 text-amber-500" />
              On the list
            </h2>
            <div className="space-y-4">
              {toTry.map((entry) => (
                <PublicEntryCard key={entry.id} entry={entry} />
              ))}
            </div>
          </section>
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

function PublicEntryCard({ entry }: { entry: GuideEntry }) {
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
