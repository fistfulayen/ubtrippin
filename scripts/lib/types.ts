import type { EventCategory, EventTier, VenueType } from '@/types/events'

export interface PipelineCity {
  id: string
  city: string
  country: string
  country_code: string | null
  slug: string
  timezone: string | null
  last_refreshed_at: string | null
}

export interface PipelineVenue {
  id: string
  city_id: string
  name: string
  venue_type: string | null
  tier: number | null
}

export interface PipelineSource {
  id: string
  city_id: string
  source_type: string | null
  name: string
  url: string
  language: string | null
  scrape_frequency: string | null
  status: string | null
  consecutive_failures: number | null
  last_scraped_at: string | null
  last_event_count: number | null
  discovered_via: string | null
  notes: string | null
}

export interface ExistingEventRecord {
  id: string
  city_id: string
  title: string
  venue_name: string | null
  description: string | null
  start_date: string
  end_date: string | null
  time_info: string | null
  significance_score: number | null
  source: string | null
  source_url: string | null
  image_url: string | null
  booking_url: string | null
  event_tier: string
}

export interface SearchResult {
  title: string
  url: string
  description: string
  pageAge: string | null
  sourceName: string | null
  language: string | null
}

export interface FeedItem {
  title: string
  link: string | null
  summary: string
  content: string
  publishedAt: string | null
  imageUrl: string | null
}

export interface DiscoveredEventCandidate {
  city_id: string
  title: string
  venue_name: string | null
  venue_id?: string | null
  venue_type: VenueType | null
  category: EventCategory
  description: string | null
  start_date: string
  end_date: string | null
  time_info: string | null
  significance_score?: number
  source: string | null
  source_url: string | null
  image_url: string | null
  price_info: string | null
  booking_url: string | null
  tags: string[]
  lineup: Array<{ name: string; url?: string }> | null
  event_tier?: EventTier
  last_verified_at?: string | null
  expires_at?: string | null
}

export interface QualityAssessment {
  score: number
  tier: EventTier
  reasoning: string
  shouldInsert: boolean
}

export interface DiaryPlan {
  summary: string
  queries: string[]
  sourcesToTry: string[]
  sourcesToSkip: string[]
}

export interface DiscoverySourceResult {
  sourceName: string
  sourceUrl: string | null
  status: 'success' | 'error' | 'skipped'
  eventsFound: number
  durationMs: number
  errorMessage: string | null
  sourceId?: string
}

export interface CityRunSummary {
  city: PipelineCity
  dryRun: boolean
  sourcesChecked: number
  candidatesFound: number
  duplicates: number
  inserted: number
  updated: number
  belowThreshold: number
  reports: DiscoverySourceResult[]
  diaryText: string
  nextDayPlan: DiaryPlan
}
