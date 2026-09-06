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
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
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
    const details = (item.details_json as Record<string, unknown>) || {}
    const pdfPath = details.ticket_pdf_path as string
    const bucket = (details.ticket_pdf_bucket as string | undefined) ?? 'ticket-attachments'
    if (!pdfPath) continue

    // email-attachments objects also back the Inbox source and may be referenced
    // by sibling items. Only legacy dedicated objects belong to this cleanup job.
    if (bucket === 'ticket-attachments') {
      const { error: deleteError } = await supabase.storage
        .from(bucket)
        .remove([pdfPath])

      if (deleteError) {
        console.error('Cron: failed to delete PDF:', pdfPath, deleteError)
        failed++
        continue
      }
    } else if (bucket !== 'email-attachments') {
      console.error('Cron: refusing unexpected ticket bucket:', bucket)
      failed++
      continue
    }

    const remainingDetails = { ...details }
    delete remainingDetails.ticket_pdf_path
    delete remainingDetails.ticket_pdf_bucket
    const { error: clearError } = await supabase
      .from('trip_items')
      .update({ details_json: remainingDetails })
      .eq('id', item.id)

    if (clearError) {
      console.error('Cron: failed to clear PDF reference:', item.id, clearError)
      failed++
      continue
    }

    deleted++
  }

  console.log(`Cron: cleaned up ${deleted} ticket PDFs, ${failed} failures`)
  return NextResponse.json({ deleted, failed, cutoff })
}
