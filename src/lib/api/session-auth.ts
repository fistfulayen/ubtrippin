import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { headers } from 'next/headers'

export interface SessionAuth {
  userId: string
}

/**
 * Authenticate via session cookie OR API key (Bearer token).
 * Tries cookie first, falls back to API key if no session.
 */
export async function requireSessionAuth(): Promise<SessionAuth | NextResponse> {
  // Try cookie-based session first
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    return { userId: user.id }
  }

  // Fall back to API key auth
  const headersList = await headers()
  const authHeader = headersList.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    // Build a minimal NextRequest for validateApiKey
    const req = new NextRequest('https://localhost', {
      headers: { authorization: authHeader },
    })
    const result = await validateApiKey(req)
    if (!isAuthError(result)) {
      return { userId: result.userId }
    }
  }

  return NextResponse.json(
    { error: { code: 'unauthorized', message: 'Authentication required.' } },
    { status: 401 }
  )
}

export function isSessionAuthError(result: SessionAuth | NextResponse): result is NextResponse {
  return result instanceof NextResponse
}
