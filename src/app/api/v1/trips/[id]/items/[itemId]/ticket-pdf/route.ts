/**
 * GET /api/v1/trips/:id/items/:itemId/ticket-pdf
 *
 * Returns a short-lived signed URL (1 hour) for downloading a stored ticket PDF.
 * SECURITY: Only accessible by the item OWNER (not family, not collaborators, not share links).
 * Tickets are access credentials — sharing a trip should never share the ticket PDFs.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidUUID } from '@/lib/validation'

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

  // SECURITY: Only the item owner can download ticket PDFs (not family, not collaborators)
  // Tickets are access credentials — never share them via trip sharing
  const { data: item } = await supabase
    .from('trip_items')
    .select('id, user_id, details_json')
    .eq('id', itemId)
    .eq('trip_id', tripId)
    .single()

  if (item && item.user_id !== user.id) {
    return NextResponse.json({ error: 'Ticket PDFs are only accessible by the owner' }, { status: 403 })
  }

  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }

  const details = item.details_json as Record<string, unknown> | null
  const pdfPath = details?.ticket_pdf_path as string | undefined

  if (!pdfPath) {
    return NextResponse.json({ error: 'No PDF stored for this ticket' }, { status: 404 })
  }

  // Determine which bucket (new items use email-attachments, old ones use ticket-attachments)
  const bucket = (details?.ticket_pdf_bucket as string) || 'ticket-attachments'
  if (!['email-attachments', 'ticket-attachments'].includes(bucket)) {
    return NextResponse.json({ error: 'Invalid ticket attachment' }, { status: 404 })
  }

  const normalizedPath = pdfPath.replace(/^\/+/, '')
  if (normalizedPath !== pdfPath || !normalizedPath.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: 'Ticket attachment does not belong to this account' }, { status: 403 })
  }

  // Use the end-user client so owner-prefix storage RLS remains authoritative.
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(normalizedPath, 3600) // 1 hour

  if (error || !data) {
    console.error('Failed to create signed URL:', error)
    return NextResponse.json({ error: 'Failed to generate download link' }, { status: 500 })
  }

  // If ?redirect=1, redirect directly (mobile-friendly, no popup blocker issues)
  const url = new URL(_request.url)
  if (url.searchParams.get('redirect') === '1') {
    return NextResponse.redirect(data.signedUrl)
  }

  return NextResponse.json({ url: data.signedUrl })
}
