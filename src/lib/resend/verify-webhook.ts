import { Webhook } from 'svix'

export interface ResendEmailPayload {
  type: 'email.received'
  created_at: string
  data: {
    email_id: string
    from: string
    to: string[]
    subject: string
    text?: string
    html?: string
    attachments?: Array<{
      filename: string
      content_type: string
      content: string // base64 encoded
    }>
    headers?: Record<string, string>
    spf?: { result: string }
    dkim?: { result: string }
    dmarc?: { result: string }
  }
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
