import { describe, expect, it } from 'vitest'
import { applyQualityThreshold } from '../lib/discover-events-core'
import { adaptSearchPlan, getPreviousDiary } from '../lib/pipeline-diary'
import { buildSourceUpdate, shouldSkipSource } from '../lib/source-tracker'
import type { DiscoveredEventCandidate, PipelineSource } from '../lib/types'

function candidate(overrides: Partial<DiscoveredEventCandidate> = {}): DiscoveredEventCandidate {
  return {
    city_id: 'city-1',
    title: 'City Jazz Night',
    venue_name: 'Room Example',
    venue_type: 'club',
    category: 'music',
    description: 'Evening set.',
    start_date: '2026-03-15',
    end_date: null,
    time_info: null,
    source: 'Search',
    source_url: 'https://example.com/jazz',
    image_url: null,
    price_info: null,
    booking_url: null,
    tags: [],
    lineup: null,
    ...overrides,
  }
}

describe('applyQualityThreshold', () => {
  it('accepts scores >= 60 and rejects lower scores', () => {
    const result = applyQualityThreshold([
      { candidate: candidate({ title: 'Major show' }), score: 88, tier: 'major' },
      { candidate: candidate({ title: 'Tiny meetup' }), score: 35, tier: 'local' },
    ])

    expect(result.accepted).toHaveLength(1)
    expect(result.accepted[0]?.candidate.title).toBe('Major show')
    expect(result.rejected).toHaveLength(1)
    expect(result.rejected[0]?.score).toBe(35)
  })
})

describe('source health tracking', () => {
  it('marks a source dormant after 10 consecutive failures', () => {
    const source: PipelineSource = {
      id: 'src-1',
      city_id: 'city-1',
      source_type: 'rss',
      name: 'Example RSS',
      url: 'https://example.com/feed.xml',
      language: 'en',
      scrape_frequency: 'daily',
      status: 'active',
      consecutive_failures: 9,
      last_scraped_at: null,
      last_event_count: 1,
      discovered_via: null,
      notes: null,
    }

    const update = buildSourceUpdate(
      source,
      {
        sourceId: source.id,
        sourceName: source.name,
        sourceUrl: source.url,
        status: 'error',
        eventsFound: 0,
        durationMs: 25,
        errorMessage: '403',
      },
      '2026-03-09T12:00:00.000Z'
    )

    expect(update.patch.consecutive_failures).toBe(10)
    expect(update.patch.status).toBe('dormant')
    expect(shouldSkipSource({ status: update.patch.status, consecutive_failures: update.patch.consecutive_failures })).toBe(true)
  })
})

describe('diary adaptation', () => {
  it('reads the most recent prior diary and carries over next-day suggestions', () => {
    const previousDiary = getPreviousDiary(
      [
        {
          run_date: '2026-03-08',
          diary_text: 'Skip Example RSS tomorrow and try tourism board coverage.',
          next_day_plan: {
            summary: 'Shift toward tourism-board searches.',
            queries: ['city exhibitions march 2026'],
            sourcesToTry: ['tourism board'],
            sourcesToSkip: ['Example RSS'],
          },
        },
      ],
      '2026-03-09'
    )

    const adapted = adaptSearchPlan({
      previousDiary,
      sources: [{ name: 'Dormant Feed', url: 'https://example.com/feed', status: 'dormant' }],
    })

    expect(previousDiary?.run_date).toBe('2026-03-08')
    expect(adapted.queries).toContain('city exhibitions march 2026')
    expect(adapted.sourcesToTry).toContain('tourism board')
    expect(adapted.sourcesToSkip).toEqual(expect.arrayContaining(['Example RSS', 'Dormant Feed']))
  })
})
