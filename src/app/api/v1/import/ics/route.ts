import { NextRequest, NextResponse } from 'next/server'
import { isSessionAuthError, requireSessionAuth } from '@/lib/api/session-auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import {
  applyDuplicateFlags,
  buildIcsPreview,
  findExistingImportHistory,
  persistIcsImport,
} from '@/lib/ics-import'

export const dynamic = 'force-dynamic'

const MAX_ICS_BYTES = 2 * 1024 * 1024

function badRequest(message: string, status = 400) {
  return NextResponse.json(
    { error: { code: 'invalid_param', message } },
    { status }
  )
}

export async function POST(request: NextRequest) {
  const auth = await requireSessionAuth()
  if (isSessionAuthError(auth)) return auth

  const limited = rateLimitResponse(auth.userId)
  if (limited) return limited

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return badRequest('Request body must be multipart form data.')
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return badRequest('An .ics file is required in the "file" field.')
  }

  if (file.size === 0) {
    return badRequest('The uploaded .ics file is empty.')
  }

  if (file.size > MAX_ICS_BYTES) {
    return badRequest('The uploaded .ics file exceeds the 2MB limit.')
  }

  if (!file.name.toLowerCase().endsWith('.ics')) {
    return badRequest('Only .ics files are supported.')
  }

  const text = await file.text()
  if (!/BEGIN:VCALENDAR/i.test(text) || !/BEGIN:VEVENT/i.test(text)) {
    return badRequest('The uploaded file does not look like a valid ICS calendar export.')
  }

  try {
    const preview = await buildIcsPreview(text)
    const duplicates = await findExistingImportHistory(
      auth.supabase,
      auth.userId,
      preview.trips.flatMap((trip) => trip.items.map((item) => item.provider_item_id))
    )
    const markedPreview = applyDuplicateFlags(preview, duplicates)

    if (request.nextUrl.searchParams.get('confirm') === 'true') {
      const persisted = await persistIcsImport(auth.supabase, auth.userId, markedPreview)
      return NextResponse.json(persisted, { status: 201 })
    }

    return NextResponse.json(markedPreview)
  } catch (error) {
    console.error('[v1/import/ics] import failed:', error)
    return NextResponse.json(
      {
        error: {
          code: 'internal_error',
          message: error instanceof Error ? error.message : 'Failed to import ICS file.',
        },
      },
      { status: 500 }
    )
  }
}
