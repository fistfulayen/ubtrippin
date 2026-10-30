/**
 * GET /api/v1/inbox/:emailId/attachments/:index
 *
 * Returns a 1-hour signed download URL for an email attachment.
 * Index refers to the position in the attachments_json array.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
  const index = /^\d+$/.test(indexStr) ? Number(indexStr) : NaN

  if (!isValidUUID(emailId) || !Number.isSafeInteger(index) || index < 0) {
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
    .eq('user_id', user.id)
    .single()

  if (!email) {
    return NextResponse.json({ error: 'Email not found' }, { status: 404 })
  }

  const attachments = (email.attachments_json || []) as StoredAttachment[]
  if (index >= attachments.length) {
    return NextResponse.json({ error: 'Attachment index out of range' }, { status: 404 })
  }

  const attachment = attachments[index]
  if (!attachment || typeof attachment.storage_path !== 'string' || !attachment.storage_path) {
    return NextResponse.json(
      { error: 'Attachment not stored (pre-dates attachment storage feature)' },
      { status: 404 }
    )
  }

  // Metadata must never confer access to another account's storage object.
  const storagePath = attachment.storage_path
  if (!storagePath.startsWith(`${user.id}/`) || storagePath.split('/').some((part) => part === '.' || part === '..')) {
    return NextResponse.json({ error: 'Attachment does not belong to this account' }, { status: 403 })
  }

  // Preserve owner-prefix storage RLS when creating the capability URL.
  const { data, error } = await supabase.storage
    .from('email-attachments')
    .createSignedUrl(storagePath, 3600)

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
