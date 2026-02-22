/**
 * SECURITY: Input validation utilities
 * Centralised validators to protect API routes from malformed / malicious input.
 */

// UUID v4 regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Returns true if the value is a valid UUID.
 * Use this to validate route params like [id] before passing to Supabase.
 */
export function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value)
}

/**
 * Returns a trimmed string if it's non-empty and within maxLength, otherwise null.
 */
export function sanitizeString(
  value: unknown,
  maxLength = 1000
): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > maxLength) return null
  return trimmed
}

/**
 * Clamp a number to a range.
 */
export function clampNumber(value: unknown, min: number, max: number): number | null {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.max(min, Math.min(max, n))
}
