import { describe, expect, it } from 'vitest'
import { dedupeCandidates, findDuplicate, titleSimilarity } from '../lib/event-dedup'
import type { DiscoveredEventCandidate } from '../lib/types'

function candidate(overrides: Partial<DiscoveredEventCandidate> = {}): DiscoveredEventCandidate {
  return {
    city_id: 'city-1',
    title: 'Monet The Late Years',
    venue_name: 'Musee Example',
    venue_type: 'museum',
    category: 'art',
    description: 'Large-format retrospective.',
    start_date: '2026-03-10',
    end_date: '2026-04-20',
    time_info: null,
    source: 'RSS',
    source_url: 'https://example.com/monet',
    image_url: null,
    price_info: null,
    booking_url: 'https://example.com/monet',
    tags: [],
    lineup: null,
    ...overrides,
  }
}

describe('titleSimilarity', () => {
  it('treats formatting-only title changes as near duplicates', () => {
    expect(titleSimilarity('Monet: The Late Years', 'MONET - The Late Years')).toBeGreaterThan(0.8)
  })
})

describe('findDuplicate', () => {
  it('matches similar titles with overlapping dates and same venue', () => {
    const match = findDuplicate(candidate(), [
      {
        id: 'evt-1',
        city_id: 'city-1',
        title: 'Monet: The Late Years',
        venue_name: 'Musee Example',
        description: 'Existing row',
        start_date: '2026-03-01',
        end_date: '2026-04-30',
        time_info: null,
        significance_score: 80,
        source: 'Search',
        source_url: 'https://example.com/existing',
        image_url: null,
        booking_url: null,
        event_tier: 'major',
      },
    ])

    expect(match?.existing.id).toBe('evt-1')
  })
})

describe('dedupeCandidates', () => {
  it('keeps the candidate with richer metadata', () => {
    const sparse = candidate({
      description: 'Short blurb.',
      image_url: null,
      booking_url: null,
    })
    const rich = candidate({
      title: 'Monet: The Late Years',
      description: 'Detailed exhibition description with curator notes and preview highlights.',
      image_url: 'https://example.com/image.jpg',
      booking_url: 'https://example.com/book',
    })

    const result = dedupeCandidates([sparse, rich])
    expect(result.unique).toHaveLength(1)
    expect(result.unique[0]?.image_url).toBe('https://example.com/image.jpg')
  })
})
