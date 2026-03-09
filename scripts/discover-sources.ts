import { createSecretClient } from '@/lib/supabase/service'
import { searchBraveWeb } from './lib/brave-search'
import { discoverFeedsFromPage } from './lib/rss-fetcher'
import type { PipelineCity, PipelineSource } from './lib/types'

interface CandidateSource {
  source_type: string
  name: string
  url: string
  language: string
  status: string
  discovered_via: string
  notes: string | null
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function languageForCity(city: PipelineCity): string {
  switch (city.country_code) {
    case 'FR':
      return 'fr'
    case 'IT':
      return 'it'
    case 'JP':
      return 'ja'
    case 'ES':
      return 'es'
    case 'NL':
      return 'nl'
    case 'DE':
      return 'de'
    case 'EE':
      return 'et'
    default:
      return 'en'
  }
}

function knownPatternUrls(city: PipelineCity): CandidateSource[] {
  const citySlug = slugify(city.city)
  const countryCode = (city.country_code ?? 'us').toLowerCase()

  return [
    {
      source_type: 'tourism_board',
      name: `Visit ${city.city}`,
      url: `https://visit${citySlug}.com`,
      language: languageForCity(city),
      status: 'candidate',
      discovered_via: 'known-pattern',
      notes: 'Tourism-board style hostname guess.',
    },
    {
      source_type: 'tourism_board',
      name: `${city.city} tourism`,
      url: `https://${citySlug}tourism.com`,
      language: languageForCity(city),
      status: 'candidate',
      discovered_via: 'known-pattern',
      notes: 'Tourism domain guess.',
    },
    {
      source_type: 'website',
      name: `Time Out ${city.city}`,
      url: `https://www.timeout.com/${citySlug}`,
      language: languageForCity(city),
      status: 'candidate',
      discovered_via: 'known-pattern',
      notes: null,
    },
    {
      source_type: 'website',
      name: `Eventbrite ${city.city}`,
      url: `https://www.eventbrite.com/d/${countryCode}--${citySlug}/${citySlug}-events/`,
      language: languageForCity(city),
      status: 'candidate',
      discovered_via: 'global-aggregator',
      notes: 'Global event aggregator.',
    },
    {
      source_type: 'website',
      name: `Bandsintown ${city.city}`,
      url: `https://www.bandsintown.com/c/${citySlug}-${countryCode}`,
      language: languageForCity(city),
      status: 'candidate',
      discovered_via: 'global-aggregator',
      notes: 'Global live music aggregator.',
    },
    {
      source_type: 'website',
      name: `Songkick ${city.city}`,
      url: `https://www.songkick.com/metro-areas/${citySlug}`,
      language: languageForCity(city),
      status: 'candidate',
      discovered_via: 'global-aggregator',
      notes: 'Global concert aggregator.',
    },
    {
      source_type: 'website',
      name: `Music Festival Wizard ${city.city}`,
      url: `https://www.musicfestivalwizard.com/festival-guide/${citySlug}/`,
      language: languageForCity(city),
      status: 'candidate',
      discovered_via: 'global-aggregator',
      notes: 'Global festival aggregator.',
    },
  ]
}

async function loadCity(citySlug: string): Promise<PipelineCity> {
  const supabase = createSecretClient()
  const { data, error } = await supabase
    .from('tracked_cities')
    .select('id, city, country, country_code, slug, timezone, last_refreshed_at')
    .eq('slug', citySlug)
    .maybeSingle()

  if (error) throw new Error(`Failed to load city "${citySlug}": ${error.message}`)
  if (!data) throw new Error(`Tracked city "${citySlug}" was not found.`)
  return data as PipelineCity
}

async function loadExistingSources(cityId: string): Promise<PipelineSource[]> {
  const supabase = createSecretClient()
  const { data, error } = await supabase
    .from('city_sources')
    .select('id, city_id, source_type, name, url, language, scrape_frequency, status, consecutive_failures, last_scraped_at, last_event_count, discovered_via, notes')
    .eq('city_id', cityId)

  if (error) throw new Error(`Failed to load existing sources: ${error.message}`)
  return (data ?? []) as PipelineSource[]
}

async function probeFeedCandidates(url: string): Promise<string[]> {
  try {
    return await discoverFeedsFromPage(url)
  } catch {
    return []
  }
}

async function searchCitySources(city: PipelineCity): Promise<CandidateSource[]> {
  const language = languageForCity(city)
  const queries = [
    `${city.city} events RSS`,
    `${city.city} tourism board`,
    `${city.city} what's on calendar`,
  ]

  const candidates: CandidateSource[] = []

  for (const query of queries) {
    const results = await searchBraveWeb(query, { count: 8 })
    for (const result of results) {
      candidates.push({
        source_type: /tourism|visit/i.test(result.title) ? 'tourism_board' : 'website',
        name: result.title.slice(0, 120),
        url: result.url,
        language,
        status: 'candidate',
        discovered_via: `brave:${query}`,
        notes: result.description.slice(0, 300),
      })

      const feedUrls = await probeFeedCandidates(result.url)
      for (const feedUrl of feedUrls) {
        candidates.push({
          source_type: 'rss',
          name: `${result.title.slice(0, 80)} feed`,
          url: feedUrl,
          language,
          status: 'candidate',
          discovered_via: `autodiscovery:${result.url}`,
          notes: 'Auto-discovered via rel=alternate.',
        })
      }
    }
  }

  return candidates
}

async function main() {
  const citySlug = process.argv[2]?.trim()
  if (!citySlug) {
    throw new Error('Usage: npx tsx scripts/discover-sources.ts <city-slug>')
  }

  const supabase = createSecretClient()
  const city = await loadCity(citySlug)
  const existing = await loadExistingSources(city.id)
  const existingUrls = new Set(existing.map((source) => source.url))
  const candidates = [...knownPatternUrls(city), ...(await searchCitySources(city))]
  const deduped = Array.from(
    new Map(candidates.map((candidate) => [candidate.url, candidate])).values()
  ).filter((candidate) => !existingUrls.has(candidate.url))

  if (deduped.length === 0) {
    console.log(`[${city.city}] No new sources discovered.`)
    return
  }

  const rows = deduped.map((candidate) => ({
    city_id: city.id,
    source_type: candidate.source_type,
    name: candidate.name,
    url: candidate.url,
    language: candidate.language,
    status: candidate.status,
    discovered_via: candidate.discovered_via,
    notes: candidate.notes,
  }))

  const { error } = await supabase.from('city_sources').insert(rows)
  if (error) throw new Error(`Failed to insert discovered sources: ${error.message}`)

  console.log(`[${city.city}] Added ${rows.length} candidate sources.`)
  for (const row of rows) {
    console.log(`  + ${row.name} (${row.source_type})`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
