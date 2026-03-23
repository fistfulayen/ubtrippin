export const GUIDE_VISIBILITIES = ['private', 'public'] as const
export type GuideVisibility = (typeof GUIDE_VISIBILITIES)[number]

export const PUBLIC_USERNAME_MIN_LENGTH = 3
export const PUBLIC_USERNAME_MAX_LENGTH = 30
export const PUBLIC_GUIDE_MIN_ENTRIES = 5
export const PUBLIC_USERNAME_COOLDOWN_DAYS = 30

const PUBLIC_USERNAME_REGEX = /^[a-z0-9_]{3,30}$/i

export function normalizePublicUsername(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  if (!trimmed) return null

  return trimmed.toLowerCase()
}

export function isGuideVisibility(value: unknown): value is GuideVisibility {
  return typeof value === 'string' && GUIDE_VISIBILITIES.includes(value as GuideVisibility)
}

export function validatePublicUsername(value: string): string | null {
  if (value.length < PUBLIC_USERNAME_MIN_LENGTH || value.length > PUBLIC_USERNAME_MAX_LENGTH) {
    return `Public username must be ${PUBLIC_USERNAME_MIN_LENGTH}-${PUBLIC_USERNAME_MAX_LENGTH} characters.`
  }

  if (!PUBLIC_USERNAME_REGEX.test(value)) {
    return 'Public username can only use letters, numbers, and underscores.'
  }

  return null
}

export function getPublicUsernameChangeAllowedAt(changedAt: string | null): string | null {
  if (!changedAt) return null

  const current = new Date(changedAt)
  if (Number.isNaN(current.getTime())) return null

  current.setUTCDate(current.getUTCDate() + PUBLIC_USERNAME_COOLDOWN_DAYS)
  return current.toISOString()
}

export function canChangePublicUsername(changedAt: string | null, now = new Date()): boolean {
  const allowedAt = getPublicUsernameChangeAllowedAt(changedAt)
  if (!allowedAt) return true

  return now.getTime() >= new Date(allowedAt).getTime()
}
