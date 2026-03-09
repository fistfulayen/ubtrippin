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

function launchRefresh(citySlug: string) {
  const repoRoot = process.cwd()
  const tsxBin = path.join(repoRoot, 'node_modules', '.bin', 'tsx')
  const args = [path.join(repoRoot, 'scripts', 'discover-events.ts'), '--city', citySlug]
  const child = existsSync(tsxBin)
    ? spawn(tsxBin, args, {
        cwd: repoRoot,
        detached: true,
        stdio: 'ignore',
        env: process.env,
      })
    : spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsx', ...args], {
        cwd: repoRoot,
        detached: true,
        stdio: 'ignore',
        env: process.env,
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

  const { data: profile, error: profileError } = await auth.supabase
    .from('profiles')
    .select('email')
    .eq('id', auth.userId)
    .maybeSingle()

  if (profileError) {
    return NextResponse.json(
      { error: { code: 'profile_lookup_failed', message: profileError.message } },
      { status: 500 }
    )
  }

  const email = profile?.email?.toLowerCase().trim()
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
