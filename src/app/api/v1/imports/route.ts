/**
 * POST /api/v1/imports
 *
 * Create an import job (TripIt CSV/ICS or Gmail API scan).
 * Pro tier only.
 *
 * Body (JSON):
 *   source    — 'tripit_csv' | 'tripit_ics' | 'gmail_api'
 *   file_url  — Supabase Storage path (required for tripit_csv / tripit_ics)
 *
 * Auth: API key via Authorization: Bearer <key>
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { createSecretClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const VALID_SOURCES = ['tripit_csv', 'tripit_ics', 'gmail_api'] as const
type ImportSource = (typeof VALID_SOURCES)[number]

export async function POST(request: NextRequest) {
  // 1. Authenticate
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  // 2. Rate limit
  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  // 3. Parse body
  let body: { source?: unknown; file_url?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } },
      { status: 400 }
    )
  }

  const source = body.source as string
  const fileUrl = body.file_url as string | undefined

  if (!source || !VALID_SOURCES.includes(source as ImportSource)) {
    return NextResponse.json(
      {
        error: {
          code: 'invalid_source',
          message: `source must be one of: ${VALID_SOURCES.join(', ')}.`,
        },
      },
      { status: 400 }
    )
  }

  if ((source === 'tripit_csv' || source === 'tripit_ics') && !fileUrl) {
    return NextResponse.json(
      {
        error: {
          code: 'missing_file_url',
          message: 'file_url is required for tripit_csv and tripit_ics imports.',
        },
      },
      { status: 400 }
    )
  }

  // 4. Pro tier gate
  const supabase = createSecretClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', auth.userId)
    .single()

  if (!profile || (profile as Record<string, unknown>).tier !== 'pro') {
    return NextResponse.json(
      {
        error: {
          code: 'pro_required',
          message: 'Imports are a Pro feature. Upgrade at https://getUBTrippin.com/settings.',
        },
      },
      { status: 403 }
    )
  }

  // 5. Create import record (status: pending — worker picks it up)
  const { data: importJob, error } = await supabase
    .from('imports')
    .insert({
      user_id: auth.userId,
      source,
      status: 'pending',
      file_url: fileUrl ?? null,
    })
    .select('id, source, status, created_at')
    .single()

  if (error || !importJob) {
    console.error('[v1/imports] Insert error:', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to create import job.' } },
      { status: 500 }
    )
  }

  return NextResponse.json(
    {
      id: importJob.id,
      source: importJob.source,
      status: importJob.status,
      created_at: importJob.created_at,
      message: 'Import queued. Poll GET /api/v1/imports/:id for status.',
    },
    { status: 202 }
  )
}

/**
 * GET /api/v1/imports
 *
 * List all import jobs for the authenticated user.
 */
export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  const supabase = createSecretClient()
  const { data: imports, error } = await supabase
    .from('imports')
    .select('id, source, status, trips_created, error, created_at, completed_at')
    .eq('user_id', auth.userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[v1/imports] Select error:', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to list imports.' } },
      { status: 500 }
    )
  }

  return NextResponse.json({ imports: imports ?? [] })
}
