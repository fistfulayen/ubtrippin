import { createHash } from 'node:crypto'
import { createSecretClient } from '@/lib/supabase/service'

export async function consumePublicRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const clientAddress = forwarded || request.headers.get('x-real-ip') || 'unknown'
  const salt = process.env.PUBLIC_RATE_LIMIT_SALT || process.env.RESEND_WEBHOOK_SECRET || ''
  const keyHash = createHash('sha256')
    .update(`${salt}\0${clientAddress}`)
    .digest('hex')

  const { data, error } = await createSecretClient().rpc('consume_public_rate_limit', {
    p_scope: scope,
    p_key_hash: keyHash,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })

  if (error) {
    console.error('[public rate limit] check failed:', error.message)
    return false
  }
  return data === true
}
