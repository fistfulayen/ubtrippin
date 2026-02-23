/**
 * In-memory rate limiter — REST API v1
 *
 * 100 requests per minute per API key (keyed by SHA-256 hash).
 * Resets on a sliding fixed-window basis.
 *
 * Note: in-memory means the counter resets on server restart and is NOT
 * shared across multiple Next.js instances/pods. Good enough for MVP; swap
 * for Redis/Upstash when needed.
 */

import { NextResponse } from 'next/server'

const WINDOW_MS = 60_000   // 1 minute
const MAX_REQUESTS = 100

interface WindowEntry {
  count: number
  resetAt: number   // epoch ms when the window resets
}

// Module-level store — persists across requests within the same process
const store = new Map<string, WindowEntry>()

/** Periodically prune stale entries to prevent unbounded memory growth. */
function pruneExpired() {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) store.delete(key)
  }
}

// Prune every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(pruneExpired, 5 * 60_000)
}

export interface RateLimitResult {
  allowed: boolean
  /** Remaining requests in the current window. */
  remaining: number
  /** Epoch seconds when the window resets. */
  resetAt: number
}

/**
 * Check & increment the rate limit for a given key hash.
 * Returns a result object indicating whether the request is allowed.
 */
export function checkRateLimit(keyHash: string): RateLimitResult {
  const now = Date.now()
  let entry = store.get(keyHash)

  if (!entry || now >= entry.resetAt) {
    // Start a new window
    entry = { count: 0, resetAt: now + WINDOW_MS }
    store.set(keyHash, entry)
  }

  entry.count += 1

  const allowed = entry.count <= MAX_REQUESTS
  const remaining = Math.max(0, MAX_REQUESTS - entry.count)

  return { allowed, remaining, resetAt: Math.ceil(entry.resetAt / 1000) }
}

/**
 * Wrap checkRateLimit into a NextResponse (429) when the limit is exceeded.
 *
 * Returns null if allowed, or a 429 NextResponse if rate-limited.
 */
export function rateLimitResponse(keyHash: string): NextResponse | null {
  const result = checkRateLimit(keyHash)

  if (result.allowed) return null

  const retryAfter = String(result.resetAt - Math.floor(Date.now() / 1000))

  return NextResponse.json(
    {
      error: {
        code: 'rate_limited',
        message: `Rate limit exceeded. Maximum ${MAX_REQUESTS} requests per minute. Retry after ${retryAfter}s.`,
      },
    },
    {
      status: 429,
      headers: {
        'Retry-After': retryAfter,
        'X-RateLimit-Limit': String(MAX_REQUESTS),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(result.resetAt),
      },
    }
  )
}
