/**
 * GET /api/v1/inbox/:emailId/attachments/:index
 *
 * Returns a 1-hour signed download URL for an email attachment.
 * Index refers to the position in the attachments_json array.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSecretClient } from '@/lib/supabase/service'
import { isValidUUID } from '@/lib/validation'

interface StoredAttachment {
  filename: string
  content_type: string
  storage_path: string | null
  is_noise?: boolean
  is_ticket?: boolean
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ emailId: string; index: string }> }
) {
  const { emailId, index: indexStr } = await params
  const index = parseInt(indexStr, 10)

  if (!isValidUUID(emailId) || isNaN(index) || index < 0) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // RLS ensures user can only access their own emails
  const { data: email } = await supabase
    .from('source_emails')
    .select('id, attachments_json')
    .eq('id', emailId)
    .single()

  if (!email) {
    return NextResponse.json({ error: 'Email not found' }, { status: 404 })
  }

  const attachments = (email.attachments_json || []) as StoredAttachment[]
  if (index >= attachments.length) {
    return NextResponse.json({ error: 'Attachment index out of range' }, { status: 404 })
  }

  const attachment = attachments[index]
  if (!attachment.storage_path) {
    return NextResponse.json(
      { error: 'Attachment not stored (pre-dates attachment storage feature)' },
      { status: 404 }
    )
  }

  const service = createSecretClient()
  const { data, error } = await service.storage
    .from('email-attachments')
    .createSignedUrl(attachment.storage_path, 3600)

  if (error || !data) {
    console.error('Failed to create signed URL for attachment:', error)
    return NextResponse.json({ error: 'Failed to generate download link' }, { status: 500 })
  }

  // If ?redirect=1, redirect directly (mobile-friendly)
  const url = new URL(request.url)
  if (url.searchParams.get('redirect') === '1') {
    return NextResponse.redirect(data.signedUrl)
  }

  return NextResponse.json({
    url: data.signedUrl,
    filename: attachment.filename,
    content_type: attachment.content_type,
  })
}
