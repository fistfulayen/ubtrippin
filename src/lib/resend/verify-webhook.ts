import { Webhook } from 'svix'

// Webhook payload - only contains metadata, NOT email body
export interface ResendEmailPayload {
  type: 'email.received'
  created_at: string
  data: {
    email_id: string
    from: string
    to: string[]
    subject: string
    // Note: text/html are NOT included in webhook - must fetch via API
    attachments?: Array<{
      id: string
      filename: string
      content_type: string
      content_disposition: string
      content_id?: string
    }>
    message_id?: string
    bcc?: string[]
    cc?: string[]
  }
}

// Full email content from resend.emails.receiving.get()
export interface ResendReceivedEmail {
  id: string
  from: string
  to: string[]
  subject: string
  text: string | null
  html: string | null
  headers: Record<string, string>
  attachments: Array<{
    id: string
    filename: string
    size: number
    content_type: string
    content_id: string
    content_disposition: string
  }>
  raw?: {
    download_url: string
    expires_at: string
  } | null
}

export function verifyWebhookSignature(
  payload: string,
  headers: {
    'svix-id': string
    'svix-timestamp': string
    'svix-signature': string
  }
): ResendEmailPayload {
  const secret = process.env.RESEND_WEBHOOK_SECRET

  if (!secret) {
    throw new Error('RESEND_WEBHOOK_SECRET is not set')
  }

  const wh = new Webhook(secret)

  return wh.verify(payload, headers) as ResendEmailPayload
}
