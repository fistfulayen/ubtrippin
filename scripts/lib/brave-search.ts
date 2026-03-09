import type { PipelineCity, SearchResult } from './types'

const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY ?? process.env.BRAVE_API_KEY
const BRAVE_SEARCH_URL = 'https://api.search.brave.com/res/v1/web/search'
let lastRequestAt = 0

interface BraveWebApiResult {
  title?: string
  url?: string
  description?: string
  age?: string
  meta_url?: {
    hostname?: string
  }
  language?: string
}

interface BraveWebApiResponse {
  web?: {
    results?: BraveWebApiResult[]
  }
}

function cityLocale(city: PipelineCity): string {
  switch (city.country_code) {
    case 'FR':
      return 'fr-FR'
    case 'IT':
      return 'it-IT'
    case 'JP':
      return 'ja-JP'
    case 'ES':
      return 'es-ES'
    case 'NL':
      return 'nl-NL'
    case 'DE':
      return 'de-DE'
    case 'EE':
      return 'et-EE'
    default:
      return 'en-US'
  }
}

export function formatSearchMonth(date: Date, city: PipelineCity): { month: string; year: string } {
  const locale = cityLocale(city)
  return {
    month: new Intl.DateTimeFormat(locale, { month: 'long' }).format(date),
    year: String(date.getFullYear()),
  }
}

export function buildSearchQueries(city: PipelineCity, date: Date, extras: string[] = []): string[] {
  const { month, year } = formatSearchMonth(date, city)
  const base = `${city.city} ${month} ${year}`
  const localized = cityLocale(city)
  const templates = localized.startsWith('fr')
    ? [`${city.city} expositions ${month} ${year}`, `${city.city} concerts ${month} ${year}`, `${city.city} festivals ${month} ${year}`]
    : localized.startsWith('it')
      ? [`${city.city} mostre ${month} ${year}`, `${city.city} concerti ${month} ${year}`, `${city.city} festival ${month} ${year}`]
      : localized.startsWith('ja')
        ? [`${city.city} events ${month} ${year}`, `${city.city} exhibitions ${month} ${year}`, `${city.city} concerts ${month} ${year}`]
        : [`${base} events`, `${base} exhibitions`, `${base} concerts`, `${base} festivals`]

  return Array.from(new Set([...templates, ...extras]))
}

async function rateLimitDelay() {
  const elapsed = Date.now() - lastRequestAt
  if (elapsed < 1000) {
    await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed))
  }
  lastRequestAt = Date.now()
}

export async function searchBraveWeb(
  query: string,
  options?: { count?: number; site?: string }
): Promise<SearchResult[]> {
  if (!BRAVE_API_KEY) {
    throw new Error('BRAVE_SEARCH_API_KEY or BRAVE_API_KEY is not configured.')
  }

  await rateLimitDelay()

  const params = new URLSearchParams({
    q: options?.site ? `site:${options.site} ${query}` : query,
    count: String(options?.count ?? 10),
    text_decorations: 'false',
    result_filter: 'web',
    extra_snippets: 'true',
  })

  const response = await fetch(`${BRAVE_SEARCH_URL}?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': BRAVE_API_KEY,
    },
  })

  if (!response.ok) {
    throw new Error(`Brave search failed: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as BraveWebApiResponse
  return (data.web?.results ?? [])
    .filter((result): result is Required<Pick<BraveWebApiResult, 'title' | 'url' | 'description'>> & BraveWebApiResult => {
      return Boolean(result.title && result.url && result.description)
    })
    .map((result) => ({
      title: result.title,
      url: result.url,
      description: result.description,
      pageAge: result.age ?? null,
      sourceName: result.meta_url?.hostname ?? null,
      language: result.language ?? null,
    }))
}
