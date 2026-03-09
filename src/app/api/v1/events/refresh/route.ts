import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { requireSessionAuth, isSessionAuthError } from '@/lib/api/session-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getAllowedAdminEmails(): Set<string> {
  const raw = process.env.EVENT_PIPELINE_ADMIN_EMAILS ?? process.env.ADMIN_EMAILS ?? ''
  return new Set(
    raw
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  )
}

/**
 * Build a minimal env for the discovery script — only the vars it actually needs.
 * Never forward the full process.env to avoid leaking secrets the script doesn't use.
 */
function buildScriptEnv(): Record<string, string | undefined> {
  const pick = (key: string): string | undefined => process.env[key]
  return {
    // Runtime essentials
    PATH: pick('PATH'),
    NODE_PATH: pick('NODE_PATH'),
    HOME: pick('HOME'),
    // Supabase (createSecretClient)
    NEXT_PUBLIC_SUPABASE_URL: pick('NEXT_PUBLIC_SUPABASE_URL'),
    SUPABASE_SECRET_KEY: pick('SUPABASE_SECRET_KEY'),
    // AI quality scoring
    OPENAI_API_KEY: pick('OPENAI_API_KEY'),
    GEMINI_API_KEY: pick('GEMINI_API_KEY'),
    // Web search
    BRAVE_SEARCH_API_KEY: pick('BRAVE_SEARCH_API_KEY'),
    BRAVE_API_KEY: pick('BRAVE_API_KEY'),
  }
}

function launchRefresh(citySlug: string) {
  const repoRoot = process.cwd()
  const tsxBin = path.join(repoRoot, 'node_modules', '.bin', 'tsx')
  const args = [path.join(repoRoot, 'scripts', 'discover-events.ts'), '--city', citySlug]
  // Cast required: spawn's env type demands ProcessEnv but we intentionally omit most vars.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scriptEnv = buildScriptEnv() as any
  const child = existsSync(tsxBin)
    ? spawn(tsxBin, args, {
        cwd: repoRoot,
        detached: true,
        stdio: 'ignore',
        env: scriptEnv,
      })
    : spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsx', ...args], {
        cwd: repoRoot,
        detached: true,
        stdio: 'ignore',
        env: scriptEnv,
      })
  child.unref()
}

export async function POST(request: NextRequest) {
  const auth = await requireSessionAuth()
  if (isSessionAuthError(auth)) return auth

  const allowedEmails = getAllowedAdminEmails()
  if (allowedEmails.size === 0) {
    return NextResponse.json(
      { error: { code: 'server_misconfigured', message: 'EVENT_PIPELINE_ADMIN_EMAILS is not configured.' } },
      { status: 500 }
    )
  }

  // Use the JWT/session email — not the user-writable profiles table — to prevent
  // privilege escalation via a crafted profiles.email value.
  const { data: { user }, error: userError } = await auth.supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json(
      { error: { code: 'session_lookup_failed', message: userError?.message ?? 'Could not resolve authenticated user.' } },
      { status: 500 }
    )
  }

  const email = user.email?.toLowerCase().trim()
  if (!email || !allowedEmails.has(email)) {
    return NextResponse.json(
      { error: { code: 'forbidden', message: 'Only event pipeline admins can trigger a refresh.' } },
      { status: 403 }
    )
  }

  const body = (await request.json().catch(() => null)) as { citySlug?: string } | null
  const citySlug = body?.citySlug?.trim()
  if (!citySlug || !/^[a-z0-9-]+$/.test(citySlug)) {
    return NextResponse.json(
      { error: { code: 'invalid_request', message: 'citySlug is required and must be a slug.' } },
      { status: 400 }
    )
  }

  try {
    launchRefresh(citySlug)
    return NextResponse.json({
      ok: true,
      queued: true,
      citySlug,
    }, { status: 202 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to launch refresh.'
    return NextResponse.json(
      { error: { code: 'launch_failed', message } },
      { status: 500 }
    )
  }
}
