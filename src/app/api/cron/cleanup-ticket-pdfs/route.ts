/**
 * GET /api/cron/cleanup-ticket-pdfs
 *
 * Vercel Cron: runs nightly at 03:00 UTC
 * Deletes ticket PDF attachments for events that ended more than 30 days ago.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY!
const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: NextRequest) {
  // Verify this is called by Vercel Cron or internally
  const authHeader = request.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY)

  // Find items with ticket_pdf_path where event was >30 days ago
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 30)
  const cutoff = cutoffDate.toISOString().split('T')[0]

  // Query items where start_date < cutoff and details_json has ticket_pdf_path
  const { data: expiredItems, error } = await supabase
    .from('trip_items')
    .select('id, details_json')
    .eq('kind', 'ticket')
    .lt('start_date', cutoff)
    .not('details_json->ticket_pdf_path', 'is', null)

  if (error) {
    console.error('Cron: failed to query expired ticket items:', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  let deleted = 0
  let failed = 0

  for (const item of expiredItems || []) {
    const pdfPath = (item.details_json as Record<string, unknown>)?.ticket_pdf_path as string
    if (!pdfPath) continue

    // Delete from storage
    const { error: deleteError } = await supabase.storage
      .from('ticket-attachments')
      .remove([pdfPath])

    if (deleteError) {
      console.error('Cron: failed to delete PDF:', pdfPath, deleteError)
      failed++
      continue
    }

    // Clear ticket_pdf_path from details_json
    const details = (item.details_json as Record<string, unknown>) || {}
    const { ticket_pdf_path: _removed, ...remainingDetails } = details
    await supabase
      .from('trip_items')
      .update({ details_json: remainingDetails })
      .eq('id', item.id)

    deleted++
  }

  console.log(`Cron: cleaned up ${deleted} ticket PDFs, ${failed} failures`)
  return NextResponse.json({ deleted, failed, cutoff })
}
