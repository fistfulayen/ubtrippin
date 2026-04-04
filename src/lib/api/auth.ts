/**
 * API Key Authentication — REST API v1
 *
 * Validates `Authorization: Bearer <key>` headers.
 * Keys are stored as SHA-256 hashes; the plain-text key is never persisted.
 */

import { createSecretClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'

export interface AuthResult {
  userId: string
  keyHash: string
}

/** Hash a raw API key with SHA-256 (hex output). */
export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex')
}

/**
 * Validate the Bearer token in the Authorization header.
 *
 * Returns { userId, keyHash } on success.
 * Returns a NextResponse (401) on failure — caller must return it immediately.
 */
export async function validateApiKey(
  request: NextRequest
): Promise<AuthResult | NextResponse> {
  const authHeader = request.headers.get('authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      {
        error: {
          code: 'unauthorized',
          message:
            'Missing or malformed Authorization header. Expected: Authorization: Bearer <api_key>',
        },
      },
      { status: 401 }
    )
  }

  const rawKey = authHeader.slice('Bearer '.length).trim()

  if (!rawKey) {
    return NextResponse.json(
      {
        error: {
          code: 'unauthorized',
          message: 'API key must not be empty.',
        },
      },
      { status: 401 }
    )
  }

  const keyHash = hashApiKey(rawKey)

  // SECURITY (L-003): Service client needed for API key lookup — this runs pre-auth
  // (no user session exists yet), so RLS cannot be applied. Read-only lookup only.
  const supabase = createSecretClient()

  const { data: apiKey, error } = await supabase
    .from('api_keys')
    .select('id, user_id')
    .eq('key_hash', keyHash)
    .single()

  if (error || !apiKey) {
    return NextResponse.json(
      {
        error: {
          code: 'unauthorized',
          message: 'Invalid API key.',
        },
      },
      { status: 401 }
    )
  }

  // Fire-and-forget: update last_used_at (don't block the response)
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKey.id)
    .then(() => {})

  return { userId: apiKey.user_id, keyHash }
}

/** Type guard: did validateApiKey return an error response? */
export function isAuthError(result: AuthResult | NextResponse): result is NextResponse {
  return result instanceof NextResponse
}
