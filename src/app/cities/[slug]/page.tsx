import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EventCard } from '@/components/events/event-card'
import { EventFeedbackForm } from '@/components/events/event-feedback-form'
import { EventFilterBar } from '@/components/events/event-filter-bar'
import { EventUpsellOverlay } from '@/components/events/event-upsell-overlay'
import { PipelineTransparency } from '@/components/events/pipeline-transparency'
import { PublicNav } from '@/components/public-nav'
import {
  flagEmoji,
  getCityEventsPageData,
  getMonthWindow,
  trimEventsForFreeTier,
} from '@/lib/events/queries'
import { getUserTier } from '@/lib/usage/limits'

interface CityPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ from?: string; to?: string; segment?: string }>
}

/** Escape strings for safe embedding in JSON-LD <script> tags */
function sanitizeForJsonLd(value: string): string {
  return value
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\//g, '\\u002f')
}

function isHttpUrl(url: string | null): url is string {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function buildStructuredData(cityName: string, events: Array<{ title: string; start_date: string; end_date: string | null; description: string | null; venue_name: string | null; booking_url: string | null }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `What's On in ${sanitizeForJsonLd(cityName)}`,
    hasPart: events.map((event) => ({
      '@type': 'Event',
      name: sanitizeForJsonLd(event.title),
      startDate: event.start_date,
      endDate: event.end_date ?? event.start_date,
      description: event.description ? sanitizeForJsonLd(event.description) : undefined,
      location: event.venue_name
        ? {
            '@type': 'Place',
            name: sanitizeForJsonLd(event.venue_name),
          }
        : undefined,
      offers: isHttpUrl(event.booking_url)
        ? {
            '@type': 'Offer',
            url: event.booking_url,
          }
        : undefined,
    })),
  }
}

export async function generateMetadata({ params, searchParams }: CityPageProps): Promise<Metadata> {
  const { slug } = await params
  const search = await searchParams
  const supabase = await createClient()
  const defaults = getMonthWindow()
  const data = await getCityEventsPageData(supabase, slug, {
    from: search.from || defaults.from,
    to: search.to || defaults.to,
  })

  if (!data) {
    return {
      title: 'City Events | UBTRIPPIN',
    }
  }

  const referenceDate = search.from ? new Date(`${search.from}T00:00:00`) : new Date()
  const monthYear = referenceDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return {
    title: `What's On in ${data.city.city} - ${monthYear} | UBTRIPPIN`,
    description: `Curated events and exhibitions in ${data.city.city} for ${monthYear}.`,
    openGraph: {
      title: `What's On in ${data.city.city} - ${monthYear}`,
      description: `Curated events and exhibitions in ${data.city.city}.`,
      images: [`/cities/${data.city.slug}/opengraph-image`],
    },
  }
}

export default async function CityPage({ params, searchParams }: CityPageProps) {
  const { slug } = await params
  const search = await searchParams
  const supabase = await createClient()
  const defaults = getMonthWindow()
  const from = search.from || defaults.from
  const to = search.to || defaults.to
  const data = await getCityEventsPageData(supabase, slug, { from, to })

  if (!data) notFound()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const tier = user ? await getUserTier(user.id, supabase) : 'free'
  const activeSegment = search.segment
  const activeEvents = activeSegment
    ? data.segments.find((segment) => segment.key === activeSegment)?.events ?? []
    : data.events

  const isTripScoped = Boolean(search.from || search.to)
  const shouldUpsell = Boolean(user && tier === 'free' && isTripScoped)
  const visibleEvents = shouldUpsell ? trimEventsForFreeTier(activeEvents, 6) : activeEvents
  const hiddenCount = shouldUpsell ? Math.max(activeEvents.length - visibleEvents.length, 0) : 0
  const structuredData = buildStructuredData(data.city.city, visibleEvents.slice(0, 8))

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white">
      <PublicNav />
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <section className="relative min-h-[280px] overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 text-white sm:min-h-[320px]">
          <div className="absolute inset-0">
            {data.city.hero_image_url ? (
              <img src={data.city.hero_image_url} alt={data.city.city} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-slate-900 to-indigo-950" />
            )}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-slate-950/10" />
          <div className="relative flex min-h-[280px] flex-col justify-end px-6 py-8 sm:min-h-[320px] sm:px-8">
            <div className="max-w-3xl space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/75">
                {flagEmoji(data.city.country_code)} {data.city.country}
              </p>
              <h1 className="font-serif text-5xl">What&apos;s On in {data.city.city}</h1>
              <p className="text-lg text-white/80">
                {visibleEvents.length} curated picks between {from} and {to}.
              </p>
            </div>
          </div>
        </section>

        <EventFilterBar segments={data.segments} activeSegment={activeSegment} />

        <section className="relative space-y-8">
          {visibleEvents.filter((event) => event.event_tier === 'major').length > 0 ? (
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Major Events</p>
              <div className="grid gap-5 lg:grid-cols-2">
                {visibleEvents
                  .filter((event) => event.event_tier === 'major')
                  .map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
              </div>
            </div>
          ) : null}

          {visibleEvents.filter((event) => event.event_tier === 'medium').length > 0 ? (
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Worth Planning Around</p>
              <div className="space-y-4">
                {visibleEvents
                  .filter((event) => event.event_tier === 'medium')
                  .map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
              </div>
            </div>
          ) : null}

          {visibleEvents.filter((event) => event.event_tier === 'local').length > 0 ? (
            <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" open>
              <summary className="cursor-pointer list-none text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Local Finds
              </summary>
              <div className="mt-4 space-y-3">
                {visibleEvents
                  .filter((event) => event.event_tier === 'local')
                  .map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
              </div>
            </details>
          ) : null}

          <EventUpsellOverlay visible={shouldUpsell} hiddenCount={hiddenCount} />
        </section>

        <PipelineTransparency diary={data.pipelineDiary} />

        {user && tier === 'pro' ? <EventFeedbackForm cityId={data.city.id} /> : null}

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </main>
    </div>
  )
}
