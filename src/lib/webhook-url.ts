import { PublicHttpError, validatePublicUrl } from '@/lib/security/public-http'

export async function validateWebhookUrl(rawUrl: string): Promise<{ ok: true; normalizedUrl: string } | { ok: false; message: string }> {
  if (!rawUrl.trim()) {
    return { ok: false, message: '"url" is required.' }
  }

  try {
    return { ok: true, normalizedUrl: await validatePublicUrl(rawUrl) }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof PublicHttpError
          ? error.message
          : 'Webhook URL could not be validated.',
    }
  }
}
