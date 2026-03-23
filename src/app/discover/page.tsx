import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Globe, MapPin } from 'lucide-react'

export const metadata: Metadata = {
  title: 'City Guides by Travelers — UBTRIPPIN',
  description:
    'Browse personal city guides from real travelers. Discover authentic recommendations for restaurants, coffee shops, hidden gems, and more — curated by people who actually live and travel there.',
  openGraph: {
    title: 'City Guides by Travelers — UBTRIPPIN',
    description:
      'Browse personal city guides from real travelers. Authentic recommendations, not SEO-optimized listicles.',
    type: 'website',
  },
}

interface PublicGuide {
  id: string
  city: string
  country: string | null
  country_code: string | null
  share_token: string | null
  public_username: string | null
  entry_count: number
  updated_at: string
}

function buildFlag(countryCode: string | null): string | null {
  if (!countryCode) return null
  try {
    return String.fromCodePoint(
      ...countryCode
        .toUpperCase()
        .split('')
        .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
    )
  } catch {
    return null
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })
}

export default async function GuidesDiscoveryPage() {
  const supabase = await createClient()

  const { data: guides } = await supabase
    .from('city_guides')
    .select('id, city, country, country_code, share_token, public_username, entry_count, updated_at')
    .eq('visibility', 'public')
    .not('share_token', 'is', null)
    .order('entry_count', { ascending: false })
    .order('updated_at', { ascending: false })

  const rows = (guides ?? []) as PublicGuide[]

  // Group by city (case-insensitive key)
  const byCity = rows.reduce<Record<string, PublicGuide[]>>((acc, guide) => {
    const key = guide.city.toLowerCase()
    if (!acc[key]) acc[key] = []
    acc[key].push(guide)
    return acc
  }, {})

  // Flatten back in order (cities ordered by their top guide's entry count)
  const cityOrder = Object.keys(byCity).sort((a, b) => {
    const aTop = byCity[a][0].entry_count ?? 0
    const bTop = byCity[b][0].entry_count ?? 0
    return bTop - aTop
  })

  const totalGuides = rows.length

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      {/* Nav */}
      <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 flex items-center justify-between h-14">
          <Link href="/" className="font-bold text-gray-900 tracking-tight">
            UBTRIPPIN
          </Link>
          <Link
            href="/login"
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Sign in
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-12 space-y-12">
        {/* Hero */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900">
            City Guides by Travelers
          </h1>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            Real recommendations from real people — not SEO-optimized listicles.
          </p>

          {totalGuides > 0 && (
            <p className="text-sm text-gray-400 flex items-center justify-center gap-1">
              <Globe className="h-4 w-4" />
              {totalGuides} guide{totalGuides !== 1 ? 's' : ''} across{' '}
              {cityOrder.length} cit{cityOrder.length !== 1 ? 'ies' : 'y'}
            </p>
          )}

          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 text-white font-semibold px-6 py-3 hover:bg-indigo-700 transition-colors text-sm"
            >
              Create your own guide — Get Started Free
            </Link>
          </div>
        </div>

        {/* Empty state */}
        {rows.length === 0 && (
          <div className="text-center py-20 space-y-4">
            <MapPin className="h-12 w-12 text-gray-300 mx-auto" />
            <p className="text-gray-400 text-lg">No public guides yet.</p>
            <p className="text-gray-400 text-sm">Be the first to share a city guide!</p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl border-2 border-gray-200 bg-transparent font-semibold px-6 py-3 hover:bg-gray-50 transition-colors text-sm mt-4"
            >
              Get started free →
            </Link>
          </div>
        )}

        {/* City sections */}
        {cityOrder.map((cityKey) => {
          const cityGuides = byCity[cityKey]
          const representativeGuide = cityGuides[0]
          const flag = buildFlag(representativeGuide.country_code)

          return (
            <section key={cityKey} className="space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  {flag && <span>{flag}</span>}
                  {representativeGuide.city}
                </h2>
                {representativeGuide.country && (
                  <span className="text-gray-400 text-sm">{representativeGuide.country}</span>
                )}
                <Badge variant="secondary" className="ml-1 text-xs">
                  {cityGuides.length} guide{cityGuides.length !== 1 ? 's' : ''}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cityGuides.map((guide) => (
                  <GuideCard key={guide.id} guide={guide} flag={flag} />
                ))}
              </div>
            </section>
          )
        })}

        {/* Bottom CTA */}
        {rows.length > 0 && (
          <div className="rounded-2xl bg-indigo-600 text-white p-8 text-center space-y-4">
            <p className="text-xl font-bold">Build your own city guide</p>
            <p className="text-indigo-200 text-sm max-w-sm mx-auto">
              UBTRIPPIN turns your local knowledge into a beautiful, shareable guide.
              Share it with friends or make it public.
            </p>
            <Link
              href="/login"
              className="inline-block rounded-xl bg-white text-indigo-700 font-semibold px-6 py-3 hover:bg-indigo-50 transition-colors text-sm"
            >
              Create your own guide — Get Started Free
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}

function GuideCard({ guide, flag }: { guide: PublicGuide; flag: string | null }) {
  return (
    <Link href={`/guide/${guide.share_token}`} className="block group">
      <Card className="h-full transition-shadow group-hover:shadow-md">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              {flag && <span className="text-2xl">{flag}</span>}
              <div>
                <p className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                  {guide.city}
                </p>
                {guide.country && (
                  <p className="text-xs text-gray-400">{guide.country}</p>
                )}
              </div>
            </div>
            <Badge variant="secondary" className="shrink-0 text-xs">
              {guide.entry_count ?? 0} places
            </Badge>
          </div>

          <div className="flex items-center justify-between text-sm text-gray-400 pt-1 border-t border-gray-50">
            {guide.public_username ? (
              <span className="font-medium text-slate-500">@{guide.public_username}</span>
            ) : (
              <span className="italic">Anonymous</span>
            )}
            <span>{formatDate(guide.updated_at)}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
