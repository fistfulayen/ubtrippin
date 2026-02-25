/**
 * GET /api/v1/imports/:id
 *
 * Check the status of a specific import job.
 * Auth: API key via Authorization: Bearer <key>
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { createSecretClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Authenticate
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  const { id } = await params

  if (!id) {
    return NextResponse.json(
      { error: { code: 'missing_id', message: 'Import ID is required.' } },
      { status: 400 }
    )
  }

  const supabase = createSecretClient()

  const { data: importJob, error } = await supabase
    .from('imports')
    .select('id, source, status, file_url, trips_created, error, created_at, completed_at')
    .eq('id', id)
    .eq('user_id', auth.userId) // RLS — users can only see their own imports
    .single()

  if (error || !importJob) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Import job not found.' } },
      { status: 404 }
    )
  }

  return NextResponse.json({
    id: importJob.id,
    source: importJob.source,
    status: importJob.status,
    trips_created: importJob.trips_created,
    error: importJob.error ?? null,
    created_at: importJob.created_at,
    completed_at: importJob.completed_at ?? null,
  })
}
