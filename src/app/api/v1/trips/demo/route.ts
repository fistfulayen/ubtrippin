/**
 * GET /api/v1/trips/demo
 *
 * Returns a hardcoded fixture trip for the demo page.
 * No authentication required, no DB queries.
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export const DEMO_TRIP = {
  id: '00000000-0000-0000-0000-000000000001',
  title: 'Tokyo Adventure',
  start_date: '2026-03-15',
  end_date: '2026-03-22',
  primary_location: 'Tokyo, Japan',
  travelers: [],
  notes: null,
  cover_image_url: null,
  share_enabled: false,
  created_at: '2026-02-01T00:00:00Z',
  updated_at: '2026-02-01T00:00:00Z',
  role: 'owner',
}

export const DEMO_ITEMS = [
  {
    id: '00000000-0000-0000-0001-000000000001',
    trip_id: '00000000-0000-0000-0000-000000000001',
    kind: 'flight',
    provider: 'ANA',
    confirmation_code: 'ABC123',
    traveler_names: ['Demo Traveler'],
    start_date: '2026-03-15',
    end_date: '2026-03-15',
    start_ts: '2026-03-15T10:00:00Z',
    end_ts: '2026-03-16T15:30:00Z',
    start_location: 'SFO',
    end_location: 'NRT',
    summary: 'ANA Flight NH 7 — San Francisco to Tokyo Narita',
    status: 'confirmed',
  },
  {
    id: '00000000-0000-0000-0001-000000000002',
    trip_id: '00000000-0000-0000-0000-000000000001',
    kind: 'hotel',
    provider: 'Park Hyatt Tokyo',
    confirmation_code: 'PHT2026',
    traveler_names: ['Demo Traveler'],
    start_date: '2026-03-16',
    end_date: '2026-03-21',
    start_ts: null,
    end_ts: null,
    start_location: 'Tokyo, Japan',
    end_location: null,
    summary: 'Park Hyatt Tokyo — 5 nights, Shinjuku',
    status: 'confirmed',
  },
  {
    id: '00000000-0000-0000-0001-000000000003',
    trip_id: '00000000-0000-0000-0000-000000000001',
    kind: 'restaurant',
    provider: 'Sukiyabashi Jiro',
    confirmation_code: null,
    traveler_names: ['Demo Traveler'],
    start_date: '2026-03-18',
    end_date: '2026-03-18',
    start_ts: '2026-03-18T12:00:00Z',
    end_ts: null,
    start_location: 'Ginza, Tokyo',
    end_location: null,
    summary: 'Sukiyabashi Jiro — omakase lunch reservation',
    status: 'confirmed',
  },
  {
    id: '00000000-0000-0000-0001-000000000004',
    trip_id: '00000000-0000-0000-0000-000000000001',
    kind: 'activity',
    provider: 'teamLab',
    confirmation_code: 'TL20260319',
    traveler_names: ['Demo Traveler'],
    start_date: '2026-03-19',
    end_date: '2026-03-19',
    start_ts: '2026-03-19T10:00:00Z',
    end_ts: '2026-03-19T14:00:00Z',
    start_location: 'Azabudai Hills, Tokyo',
    end_location: null,
    summary: 'teamLab Borderless — digital art museum',
    status: 'confirmed',
  },
  {
    id: '00000000-0000-0000-0001-000000000005',
    trip_id: '00000000-0000-0000-0000-000000000001',
    kind: 'train',
    provider: 'JR East',
    confirmation_code: 'JRPASS',
    traveler_names: ['Demo Traveler'],
    start_date: '2026-03-20',
    end_date: '2026-03-20',
    start_ts: '2026-03-20T09:00:00Z',
    end_ts: '2026-03-20T10:30:00Z',
    start_location: 'Tokyo',
    end_location: 'Kyoto',
    summary: 'Shinkansen Nozomi 1 — Tokyo to Kyoto day trip',
    status: 'confirmed',
  },
  {
    id: '00000000-0000-0000-0001-000000000006',
    trip_id: '00000000-0000-0000-0000-000000000001',
    kind: 'flight',
    provider: 'ANA',
    confirmation_code: 'ABC123',
    traveler_names: ['Demo Traveler'],
    start_date: '2026-03-22',
    end_date: '2026-03-22',
    start_ts: '2026-03-22T17:00:00Z',
    end_ts: '2026-03-22T10:30:00Z',
    start_location: 'NRT',
    end_location: 'SFO',
    summary: 'ANA Flight NH 8 — Tokyo Narita to San Francisco',
    status: 'confirmed',
  },
]

export async function GET() {
  return NextResponse.json({
    data: {
      trip: DEMO_TRIP,
      items: DEMO_ITEMS,
    },
    meta: { demo: true },
  })
}
