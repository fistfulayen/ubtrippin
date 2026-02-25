import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface SessionAuth {
  userId: string
}

export async function requireSessionAuth(): Promise<SessionAuth | NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Authentication required.' } },
      { status: 401 }
    )
  }

  return { userId: user.id }
}

export function isSessionAuthError(result: SessionAuth | NextResponse): result is NextResponse {
  return result instanceof NextResponse
}
