export type EventTier = 'major' | 'medium' | 'local'
export type EventCategory =
  | 'art'
  | 'music'
  | 'theater'
  | 'food'
  | 'festival'
  | 'sports'
  | 'architecture'
  | 'sacred'
  | 'market'
  | 'other'
export type VenueType =
  | 'museum'
  | 'theater'
  | 'concert_hall'
  | 'gallery'
  | 'stadium'
  | 'outdoor'
  | 'sacred_venue'
  | 'club'
  | 'other'

export interface CityEvent {
  id: string
  city_id: string
  venue_id: string | null
  parent_event_id: string | null
  title: string
  venue_name: string | null
  venue_type: VenueType | null
  category: EventCategory
  event_tier: EventTier
  description: string | null
  start_date: string
  end_date: string | null
  time_info: string | null
  significance_score: number
  source: string | null
  source_url: string | null
  image_url: string | null
  price_info: string | null
  booking_url: string | null
  tags: string[]
  lineup: Array<{ name: string; id?: string; url?: string }> | null
  last_verified_at: string | null
  expires_at: string | null
  children?: CityEvent[]
}

export interface TrackedCity {
  id: string
  city: string
  country: string
  country_code: string | null
  slug: string
  latitude: number | null
  longitude: number | null
  timezone: string | null
  hero_image_url: string | null
  last_refreshed_at: string | null
  active_event_count?: number
  next_notable_event?: { title: string; date: string } | null
}

export interface PipelineDiary {
  id: string
  city_id: string
  run_date: string
  diary_text: string
  run_metadata: {
    sources_checked?: number
    rss_count?: number
    web_count?: number
    ai_count?: number
    events_found?: number
    duplicates?: number
    below_threshold?: number
    new_events?: number
    duplicate_rate?: number
  }
  next_day_plan: unknown
}

export interface EventSegment {
  key: string
  label: string
  events: CityEvent[]
}

export interface DistanceGroup {
  label: string
  icon: string
  segments: EventSegment[]
}

export interface CityEventsPageData {
  city: TrackedCity
  events: CityEvent[]
  segments: EventSegment[]
  distanceGroups: DistanceGroup[]
  pipelineDiary: PipelineDiary | null
}
