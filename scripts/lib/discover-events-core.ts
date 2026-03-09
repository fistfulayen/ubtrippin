import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays } from 'date-fns'
import { buildSearchQueries, searchBraveWeb } from './brave-search'
import { choosePreferredEvent, dedupeCandidates, findDuplicate } from './event-dedup'
import { adaptSearchPlan, getPreviousDiary, type DiaryRowLike } from './pipeline-diary'
import { draftDiaryFromAi, extractEventFromText, scoreEventQuality } from './quality-scorer'
import { fetchFeedItems } from './rss-fetcher'
import { buildSourceUpdate, shouldSkipSource } from './source-tracker'
import type {
  CityRunSummary,
  DiscoveredEventCandidate,
  DiscoverySourceResult,
  ExistingEventRecord,
  PipelineCity,
  PipelineSource,
  PipelineVenue,
  SearchResult,
} from './types'

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function clampText(value: string | null | undefined, max = 2000): string | null {
  if (!value) return null
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized ? normalized.slice(0, max) : null
}

function classifyCategory(text: string): DiscoveredEventCandidate['category'] {
  if (/\b(exhibit|museum|gallery|retrospective|biennale)\b/i.test(text)) return 'art'
  if (/\b(concert|music|orchestra|jazz|dj|opera)\b/i.test(text)) return 'music'
  if (/\b(theater|theatre|play|ballet)\b/i.test(text)) return 'theater'
  if (/\b(food|wine|tasting|restaurant)\b/i.test(text)) return 'food'
  if (/\b(festival|carnival|parade)\b/i.test(text)) return 'festival'
  if (/\b(match|game|race|grand prix|tournament)\b/i.test(text)) return 'sports'
  if (/\b(architecture|design week)\b/i.test(text)) return 'architecture'
  if (/\b(cathedral|church|basilica|temple)\b/i.test(text)) return 'sacred'
  if (/\b(market|fair)\b/i.test(text)) return 'market'
  return 'other'
}

function classifyVenueType(text: string): DiscoveredEventCandidate['venue_type'] {
  if (/\bmuseum\b/i.test(text)) return 'museum'
  if (/\btheat(re|er)\b/i.test(text)) return 'theater'
  if (/\bgallery\b/i.test(text)) return 'gallery'
  if (/\bstadium|arena\b/i.test(text)) return 'stadium'
  if (/\bchurch|cathedral|temple|basilica\b/i.test(text)) return 'sacred_venue'
  if (/\bclub\b/i.test(text)) return 'club'
  return null
}

function parseDateText(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized
  const parsed = Date.parse(normalized)
  if (Number.isNaN(parsed)) return null
  return new Date(parsed).toISOString().slice(0, 10)
}

function buildCandidate(args: {
  city: PipelineCity
  sourceName: string
  sourceUrl: string | null
  title: string
  description: string | null
  startDate: string
  endDate?: string | null
  bookingUrl?: string | null
  imageUrl?: string | null
  venueName?: string | null
  tags?: string[]
}): DiscoveredEventCandidate {
  const combined = `${args.title} ${args.description ?? ''} ${args.venueName ?? ''}`
  return {
    city_id: args.city.id,
    title: args.title.trim(),
    venue_name: args.venueName ?? null,
    venue_type: classifyVenueType(combined),
    category: classifyCategory(combined),
    description: clampText(args.description, 4000),
    start_date: args.startDate,
    end_date: args.endDate ?? null,
    time_info: null,
    source: args.sourceName,
    source_url: args.sourceUrl,
    image_url: args.imageUrl ?? null,
    price_info: null,
    booking_url: args.bookingUrl ?? args.sourceUrl,
    tags: args.tags ?? [],
    lineup: null,
  }
}

function sourceDuration(startedAt: number): number {
  return Math.max(1, Date.now() - startedAt)
}

function extractFallbackDate(result: SearchResult): string | null {
  return parseDateText(result.pageAge)
}

function resolveVenue(candidate: DiscoveredEventCandidate, venues: PipelineVenue[]): PipelineVenue | null {
  const normalized = (candidate.venue_name ?? '').toLowerCase().trim()
  if (!normalized) return null
  return (
    venues.find((venue) => venue.name.toLowerCase().trim() === normalized) ??
    venues.find((venue) => normalized.includes(venue.name.toLowerCase().trim()))
  ) ?? null
}

async function sourceToCandidatesFromFeed(args: {
  city: PipelineCity
  source: PipelineSource
}): Promise<DiscoveredEventCandidate[]> {
  const items = await fetchFeedItems(args.source.url)
  const candidates: DiscoveredEventCandidate[] = []

  for (const item of items) {
    const fallbackDate = parseDateText(item.publishedAt)
    const extracted = await extractEventFromText({
      city: args.city,
      sourceName: args.source.name,
      sourceUrl: item.link ?? args.source.url,
      text: [item.title, item.summary, item.content].filter(Boolean).join('\n'),
      fallbackDate,
    })

    const title = clampText(extracted.title ?? item.title, 200)
    const startDate = parseDateText(extracted.start_date) ?? fallbackDate
    if (!extracted.isEvent || !title || !startDate) continue

    candidates.push(
      buildCandidate({
        city: args.city,
        sourceName: args.source.name,
        sourceUrl: item.link ?? args.source.url,
        title,
        description: extracted.description ?? item.summary ?? item.content,
        startDate,
        endDate: parseDateText(extracted.end_date),
        bookingUrl: extracted.booking_url ?? item.link,
        imageUrl: extracted.image_url ?? item.imageUrl,
        venueName: extracted.venue_name ?? null,
        tags: extracted.tags ?? [],
      })
    )
  }

  return candidates
}

async function sourceToCandidatesFromSearch(args: {
  city: PipelineCity
  query: string
  sourceName: string
  site?: string
}): Promise<DiscoveredEventCandidate[]> {
  const results = await searchBraveWeb(args.query, { count: 10, site: args.site })
  const candidates: DiscoveredEventCandidate[] = []

  for (const result of results) {
    const extracted = await extractEventFromText({
      city: args.city,
      sourceName: args.sourceName,
      sourceUrl: result.url,
      text: [result.title, result.description].join('\n'),
      fallbackDate: extractFallbackDate(result),
    })

    const title = clampText(extracted.title ?? result.title, 200)
    const startDate = parseDateText(extracted.start_date) ?? extractFallbackDate(result)
    if (!extracted.isEvent || !title || !startDate) continue

    candidates.push(
      buildCandidate({
        city: args.city,
        sourceName: args.sourceName,
        sourceUrl: result.url,
        title,
        description: extracted.description ?? result.description,
        startDate,
        endDate: parseDateText(extracted.end_date),
        bookingUrl: extracted.booking_url ?? result.url,
        imageUrl: extracted.image_url ?? null,
        venueName: extracted.venue_name ?? null,
        tags: extracted.tags ?? [],
      })
    )
  }

  return candidates
}

export function applyQualityThreshold(scored: Array<{
  candidate: DiscoveredEventCandidate
  score: number
  tier: 'major' | 'medium' | 'local'
}>): {
  accepted: Array<{ candidate: DiscoveredEventCandidate; score: number; tier: 'major' | 'medium' | 'local' }>
  rejected: Array<{ candidate: DiscoveredEventCandidate; score: number }>
} {
  const accepted: Array<{ candidate: DiscoveredEventCandidate; score: number; tier: 'major' | 'medium' | 'local' }> = []
  const rejected: Array<{ candidate: DiscoveredEventCandidate; score: number }> = []

  for (const item of scored) {
    if (item.score >= 60) {
      accepted.push(item)
    } else {
      rejected.push({ candidate: item.candidate, score: item.score })
    }
  }

  return { accepted, rejected }
}

export async function runCityDiscovery(args: {
  supabase: SupabaseClient
  city: PipelineCity
  dryRun?: boolean
  now?: Date
}): Promise<CityRunSummary> {
  const now = args.now ?? new Date()
  const runDate = isoDate(now)
  const nowIso = now.toISOString()
  const dryRun = Boolean(args.dryRun)

  const [{ data: sourcesData, error: sourcesError }, { data: venuesData, error: venuesError }, { data: diariesData, error: diariesError }] =
    await Promise.all([
      args.supabase
        .from('city_sources')
        .select('id, city_id, source_type, name, url, language, scrape_frequency, status, consecutive_failures, last_scraped_at, last_event_count, discovered_via, notes')
        .eq('city_id', args.city.id)
        .order('created_at', { ascending: true }),
      args.supabase
        .from('tracked_venues')
        .select('id, city_id, name, venue_type, tier')
        .eq('city_id', args.city.id),
      args.supabase
        .from('event_pipeline_diary')
        .select('run_date, diary_text, next_day_plan')
        .eq('city_id', args.city.id)
        .order('run_date', { ascending: false })
        .limit(5),
    ])

  if (sourcesError) throw new Error(`Failed to load sources for ${args.city.slug}: ${sourcesError.message}`)
  if (venuesError) throw new Error(`Failed to load venues for ${args.city.slug}: ${venuesError.message}`)
  if (diariesError) throw new Error(`Failed to load diaries for ${args.city.slug}: ${diariesError.message}`)

  const sources = (sourcesData ?? []) as PipelineSource[]
  const venues = (venuesData ?? []) as PipelineVenue[]
  const previousDiary = getPreviousDiary((diariesData ?? []) as DiaryRowLike[], runDate)
  const adaptedPlan = adaptSearchPlan({
    previousDiary,
    sources,
  })

  const searchQueries = buildSearchQueries(args.city, now, adaptedPlan.queries)
  const reports: DiscoverySourceResult[] = []
  const rawCandidates: DiscoveredEventCandidate[] = []

  for (const source of sources) {
    const startedAt = Date.now()
    if (shouldSkipSource(source) || adaptedPlan.sourcesToSkip.some((entry) => source.name.includes(entry) || source.url.includes(entry))) {
      reports.push({
        sourceId: source.id,
        sourceName: source.name,
        sourceUrl: source.url,
        status: 'skipped',
        eventsFound: 0,
        durationMs: sourceDuration(startedAt),
        errorMessage: null,
      })
      continue
    }

    if (source.source_type !== 'rss') continue

    try {
      const candidates = await sourceToCandidatesFromFeed({
        city: args.city,
        source,
      })
      rawCandidates.push(...candidates)
      reports.push({
        sourceId: source.id,
        sourceName: source.name,
        sourceUrl: source.url,
        status: 'success',
        eventsFound: candidates.length,
        durationMs: sourceDuration(startedAt),
        errorMessage: null,
      })
    } catch (error) {
      reports.push({
        sourceId: source.id,
        sourceName: source.name,
        sourceUrl: source.url,
        status: 'error',
        eventsFound: 0,
        durationMs: sourceDuration(startedAt),
        errorMessage: error instanceof Error ? error.message : 'Unknown RSS error',
      })
    }
  }

  const querySpecs: Array<{ sourceName: string; query: string; site?: string }> = [
    ...searchQueries.map((query) => ({ sourceName: 'Brave Search', query })),
    ...['eventbrite.com', 'bandsintown.com', 'songkick.com', 'musicfestivalwizard.com'].flatMap((site) =>
      searchQueries.slice(0, 2).map((query) => ({
        sourceName: site.replace('.com', ''),
        query,
        site,
      }))
    ),
  ]

  for (const spec of querySpecs) {
    const startedAt = Date.now()
    try {
      const candidates = await sourceToCandidatesFromSearch({
        city: args.city,
        query: spec.query,
        sourceName: spec.sourceName,
        site: spec.site,
      })
      rawCandidates.push(...candidates)
      reports.push({
        sourceName: spec.sourceName,
        sourceUrl: spec.site ? `https://${spec.site}` : null,
        status: 'success',
        eventsFound: candidates.length,
        durationMs: sourceDuration(startedAt),
        errorMessage: null,
      })
    } catch (error) {
      reports.push({
        sourceName: spec.sourceName,
        sourceUrl: spec.site ? `https://${spec.site}` : null,
        status: 'error',
        eventsFound: 0,
        durationMs: sourceDuration(startedAt),
        errorMessage: error instanceof Error ? error.message : 'Unknown search error',
      })
    }
  }

  const { unique } = dedupeCandidates(rawCandidates)
  const minExistingDate = isoDate(addDays(now, -30))
  const maxExistingDate = isoDate(addDays(now, 120))
  const { data: existingData, error: existingError } = await args.supabase
    .from('city_events')
    .select('id, city_id, title, venue_name, description, start_date, end_date, time_info, significance_score, source, source_url, image_url, booking_url, event_tier')
    .eq('city_id', args.city.id)
    .gte('start_date', minExistingDate)
    .lte('start_date', maxExistingDate)

  if (existingError) throw new Error(`Failed to load existing events for ${args.city.slug}: ${existingError.message}`)
  const existingEvents = (existingData ?? []) as ExistingEventRecord[]
  const scored: Array<{ candidate: DiscoveredEventCandidate; score: number; tier: 'major' | 'medium' | 'local' }> = []
  let duplicateCount = rawCandidates.length - unique.length
  let updated = 0

  for (const candidate of unique) {
    const match = findDuplicate(candidate, existingEvents)
    if (match) {
      duplicateCount += 1
      if (choosePreferredEvent(candidate, match.existing) === 'candidate') {
        const venue = resolveVenue(candidate, venues)
        const quality = await scoreEventQuality({
          city: args.city,
          candidate,
          trackedVenue: venue,
        })
        if (quality.shouldInsert) {
          if (dryRun) {
            // Dry-run: count what would have been updated without writing anything
            updated += 1
          } else {
            const patch = {
              title: candidate.title,
              venue_name: candidate.venue_name,
              venue_id: venue?.id ?? null,
              venue_type: candidate.venue_type,
              category: candidate.category,
              description: candidate.description,
              start_date: candidate.start_date,
              end_date: candidate.end_date,
              time_info: candidate.time_info,
              significance_score: quality.score,
              source: candidate.source,
              source_url: candidate.source_url,
              image_url: candidate.image_url,
              price_info: candidate.price_info,
              booking_url: candidate.booking_url,
              tags: candidate.tags,
              lineup: candidate.lineup,
              event_tier: quality.tier,
              last_verified_at: nowIso,
              expires_at: isoDate(addDays(new Date(`${candidate.end_date ?? candidate.start_date}T00:00:00Z`), 1)),
            }

            const { error } = await args.supabase.from('city_events').update(patch).eq('id', match.existing.id)
            if (!error) updated += 1
          }
        }
      }
      continue
    }

    const venue = resolveVenue(candidate, venues)
    const quality = await scoreEventQuality({
      city: args.city,
      candidate,
      trackedVenue: venue,
    })
    scored.push({
      candidate,
      score: quality.score,
      tier: quality.tier,
    })
  }

  const { accepted, rejected } = applyQualityThreshold(scored)
  const rowsToInsert = accepted.map(({ candidate, score, tier }) => ({
    city_id: args.city.id,
    venue_id: resolveVenue(candidate, venues)?.id ?? null,
    title: candidate.title,
    venue_name: candidate.venue_name,
    venue_type: candidate.venue_type,
    category: candidate.category,
    event_tier: tier,
    description: candidate.description,
    start_date: candidate.start_date,
    end_date: candidate.end_date,
    time_info: candidate.time_info,
    significance_score: score,
    source: candidate.source,
    source_url: candidate.source_url,
    image_url: candidate.image_url,
    price_info: candidate.price_info,
    booking_url: candidate.booking_url,
    tags: candidate.tags,
    lineup: candidate.lineup,
    last_verified_at: nowIso,
    expires_at: isoDate(addDays(new Date(`${candidate.end_date ?? candidate.start_date}T00:00:00Z`), 1)),
  }))

  if (!dryRun && rowsToInsert.length > 0) {
    const { error } = await args.supabase.from('city_events').insert(rowsToInsert)
    if (error) throw new Error(`Failed to insert events for ${args.city.slug}: ${error.message}`)
  }

  if (!dryRun) {
    for (const source of sources) {
      const report = reports.find((entry) => entry.sourceId === source.id)
      if (!report) continue
      const update = buildSourceUpdate(source, report, nowIso)
      await args.supabase.from('city_sources').update(update.patch).eq('id', source.id)
      await args.supabase.from('event_source_reports').insert(update.report)
    }

    const extraReports = reports.filter((report) => !report.sourceId)
    if (extraReports.length > 0) {
      await args.supabase.from('event_source_reports').insert(
        extraReports.map((report) => ({
          city_id: args.city.id,
          source_name: report.sourceName,
          source_url: report.sourceUrl,
          run_date: runDate,
          status: report.status,
          events_found: report.eventsFound,
          error_message: report.errorMessage,
          duration_ms: report.durationMs,
        }))
      )
    }
  }

  const sourceFailures = reports.filter((report) => report.status === 'error').map((report) => report.sourceName)
  const sourceWins = reports.filter((report) => report.status === 'success' && report.eventsFound > 0).map((report) => report.sourceName)
  const diary = await draftDiaryFromAi({
    city: args.city,
    previousDiaryText: previousDiary?.diary_text ?? null,
    summary: {
      sourcesChecked: reports.filter((report) => report.status !== 'skipped').length,
      candidatesFound: rawCandidates.length,
      duplicates: duplicateCount,
      inserted: rowsToInsert.length,
      belowThreshold: rejected.length,
      sourceFailures,
      sourceWins,
    },
  })

  if (!dryRun) {
    await args.supabase
      .from('event_pipeline_diary')
      .upsert({
        city_id: args.city.id,
        run_date: runDate,
        diary_text: diary.diaryText,
        run_metadata: {
          sources_checked: reports.filter((report) => report.status !== 'skipped').length,
          rss_count: reports.filter((report) => report.sourceId).length,
          web_count: reports.filter((report) => !report.sourceId).length,
          ai_count: scored.length,
          events_found: rawCandidates.length,
          duplicates: duplicateCount,
          below_threshold: rejected.length,
          new_events: rowsToInsert.length,
          duplicate_rate: rawCandidates.length ? Number((duplicateCount / rawCandidates.length).toFixed(2)) : 0,
        },
        next_day_plan: diary.nextDayPlan,
      })

    await args.supabase
      .from('tracked_cities')
      .update({ last_refreshed_at: nowIso })
      .eq('id', args.city.id)
  }

  return {
    city: args.city,
    dryRun,
    sourcesChecked: reports.filter((report) => report.status !== 'skipped').length,
    candidatesFound: rawCandidates.length,
    duplicates: duplicateCount,
    inserted: rowsToInsert.length,
    updated,
    belowThreshold: rejected.length,
    reports,
    diaryText: diary.diaryText,
    nextDayPlan: diary.nextDayPlan,
  }
}
