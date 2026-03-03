/**
 * GET /api/v1/trips/:id/items/:itemId/ticket-pdf
 *
 * Returns a short-lived signed URL (1 hour) for downloading a stored ticket PDF.
 * Only accessible by the trip owner or family members with access.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { isValidUUID } from '@/lib/validation'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY!

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: tripId, itemId } = await params

  if (!isValidUUID(tripId) || !isValidUUID(itemId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify user can access this item (RLS on trip_items handles owner + family)
  const { data: item } = await supabase
    .from('trip_items')
    .select('id, details_json')
    .eq('id', itemId)
    .eq('trip_id', tripId)
    .single()

  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }

  const details = item.details_json as Record<string, unknown> | null
  const pdfPath = details?.ticket_pdf_path as string | undefined

  if (!pdfPath) {
    return NextResponse.json({ error: 'No PDF stored for this ticket' }, { status: 404 })
  }

  // Generate a 1-hour signed URL using service client
  const service = createServiceClient(SUPABASE_URL, SUPABASE_SECRET_KEY)
  const { data, error } = await service.storage
    .from('ticket-attachments')
    .createSignedUrl(pdfPath, 3600) // 1 hour

  if (error || !data) {
    console.error('Failed to create signed URL:', error)
    return NextResponse.json({ error: 'Failed to generate download link' }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl })
}
