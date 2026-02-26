import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'

export interface WebhookRequestAuth {
  userId: string
  keyHash: string | null
}

export async function authenticateWebhookRequest(
  request: NextRequest
): Promise<WebhookRequestAuth | NextResponse> {
  const authHeader = request.headers.get('authorization')

  if (authHeader?.startsWith('Bearer ')) {
    const auth = await validateApiKey(request)
    if (isAuthError(auth)) return auth
    return {
      userId: auth.userId,
      keyHash: auth.keyHash,
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Authentication required.' } },
      { status: 401 }
    )
  }

  return {
    userId: user.id,
    keyHash: null,
  }
}

export function isWebhookAuthError(
  result: WebhookRequestAuth | NextResponse
): result is NextResponse {
  return result instanceof NextResponse
}
