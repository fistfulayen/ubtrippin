import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createUserScopedClient } from '@/lib/supabase/user-scoped'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { headers } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface SessionAuth {
  userId: string
  supabase: SupabaseClient
}

/**
 * Authenticate via session cookie OR API key (Bearer token).
 * Tries cookie first, falls back to API key if no session.
 * Returns a Supabase client scoped to the authenticated user.
 */
export async function requireSessionAuth(): Promise<SessionAuth | NextResponse> {
  // Try cookie-based session first
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    return { userId: user.id, supabase }
  }

  // Fall back to API key auth
  const headersList = await headers()
  const authHeader = headersList.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const req = new NextRequest('https://localhost', {
      headers: { authorization: authHeader },
    })
    const result = await validateApiKey(req)
    if (!isAuthError(result)) {
      const scopedClient = await createUserScopedClient(result.userId)
      return { userId: result.userId, supabase: scopedClient }
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
