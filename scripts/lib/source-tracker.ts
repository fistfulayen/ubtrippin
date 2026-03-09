import type { DiscoverySourceResult, PipelineSource } from './types'

export function shouldSkipSource(source: Pick<PipelineSource, 'status' | 'consecutive_failures'>): boolean {
  return source.status === 'dormant' || (source.consecutive_failures ?? 0) >= 10
}

export function buildSourceUpdate(
  source: PipelineSource,
  result: DiscoverySourceResult,
  nowIso: string
): {
  patch: {
    consecutive_failures: number
    last_scraped_at: string
    last_event_count: number
    status: string
  }
  report: {
    city_id: string
    source_name: string
    source_url: string | null
    run_date: string
    status: string
    events_found: number
    error_message: string | null
    duration_ms: number
  }
} {
  const nextFailures = result.status === 'error' ? (source.consecutive_failures ?? 0) + 1 : 0
  const status = nextFailures >= 10 ? 'dormant' : result.status === 'success' ? 'active' : source.status ?? 'candidate'

  return {
    patch: {
      consecutive_failures: nextFailures,
      last_scraped_at: nowIso,
      last_event_count: result.eventsFound,
      status,
    },
    report: {
      city_id: source.city_id,
      source_name: result.sourceName,
      source_url: result.sourceUrl,
      run_date: nowIso.slice(0, 10),
      status: result.status,
      events_found: result.eventsFound,
      error_message: result.errorMessage,
      duration_ms: result.durationMs,
    },
  }
}
