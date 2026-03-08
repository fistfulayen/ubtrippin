/**
 * GET /api/v1/trips/demo
 *
 * Returns a hardcoded fixture trip for the demo page.
 * No authentication required, no DB queries.
 */

import { NextResponse } from 'next/server'
import { DEMO_ITEMS, DEMO_TRIP } from '@/lib/trips/demo-trip-data'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    data: {
      trip: DEMO_TRIP,
      items: DEMO_ITEMS,
    },
    meta: { demo: true },
  })
}
