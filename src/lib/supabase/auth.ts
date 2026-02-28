type SearchParamsLike = Pick<URLSearchParams, 'get'>

const REDIRECT_PARAM_KEYS = ['redirectTo', 'redirect', 'next'] as const

function decodeURIComponentSafely(value: string): string {
  let decoded = value

  for (let i = 0; i < 2; i += 1) {
    try {
      const next = decodeURIComponent(decoded)
      if (next === decoded) break
      decoded = next
    } catch {
      break
    }
  }

  return decoded
}

function toSafePath(value: string, origin?: string): string | null {
  const decoded = decodeURIComponentSafely(value.trim())
  if (!decoded) return null
  if (decoded.startsWith('//')) return null
  if (/[\r\n]/.test(decoded)) return null

  if (decoded.startsWith('/')) {
    return decoded
  }

  try {
    if (!origin) return null
    const url = new URL(decoded)
    if (url.origin !== origin) return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

export function getRequestedRedirect(searchParams: SearchParamsLike): string | null {
  for (const key of REDIRECT_PARAM_KEYS) {
    const value = searchParams.get(key)
    if (value) return value
  }
  return null
}

export function resolveSafeRedirectPath(
  requestedRedirect: string | null | undefined,
  options?: {
    fallbackPath?: string
    origin?: string
  }
): string {
  const fallbackPath = options?.fallbackPath ?? '/trips'
  if (!requestedRedirect) return fallbackPath

  return toSafePath(requestedRedirect, options?.origin) ?? fallbackPath
}

export function resolveSafeRedirectFromSearchParams(
  searchParams: SearchParamsLike,
  options?: {
    fallbackPath?: string
    origin?: string
  }
): string {
  return resolveSafeRedirectPath(getRequestedRedirect(searchParams), options)
}

export function buildOAuthCallbackUrl(origin: string, redirectPath: string): string {
  const callbackUrl = new URL('/auth/callback', origin)
  callbackUrl.searchParams.set('redirectTo', redirectPath)
  return callbackUrl.toString()
}
