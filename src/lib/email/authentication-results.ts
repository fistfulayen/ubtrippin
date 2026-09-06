export interface InboundAuthenticationResult {
  authenticated: boolean
  authservId: string | null
  dmarc: 'pass' | 'fail' | null
  headerFrom: string | null
  reason: 'pass' | 'missing' | 'untrusted_authserv' | 'dmarc_failed' | 'unaligned'
}

function headerValue(headers: Record<string, string> | null | undefined, name: string): string {
  if (!headers) return ''
  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name)
  return match?.[1] ?? ''
}

/**
 * Accept only a DMARC pass produced by a configured receiving auth service and
 * aligned to the visible From domain. A sender-supplied Authentication-Results
 * header is not authority unless its authserv-id is explicitly trusted.
 */
export function verifyInboundAuthentication(
  headers: Record<string, string> | null | undefined,
  fromEmail: string,
  trustedAuthservIds: string[]
): InboundAuthenticationResult {
  const raw = headerValue(headers, 'authentication-results').trim()
  if (!raw) {
    return { authenticated: false, authservId: null, dmarc: null, headerFrom: null, reason: 'missing' }
  }

  const authservId = raw.split(';', 1)[0]?.trim().toLowerCase() || null
  if (!authservId || !trustedAuthservIds.map((value) => value.toLowerCase()).includes(authservId)) {
    return { authenticated: false, authservId, dmarc: null, headerFrom: null, reason: 'untrusted_authserv' }
  }

  const dmarcMatch = raw.match(/(?:^|[;\s])dmarc=(pass|fail|none|temperror|permerror)\b/i)
  const dmarc = dmarcMatch?.[1]?.toLowerCase() === 'pass' ? 'pass' : dmarcMatch ? 'fail' : null
  const headerFrom = raw.match(/\bheader\.from=([^;\s]+)/i)?.[1]?.replace(/^"|"$/g, '').toLowerCase() ?? null
  if (dmarc !== 'pass') {
    return { authenticated: false, authservId, dmarc, headerFrom, reason: 'dmarc_failed' }
  }

  const fromDomain = fromEmail.trim().toLowerCase().split('@').pop() ?? ''
  if (!headerFrom || headerFrom !== fromDomain) {
    return { authenticated: false, authservId, dmarc, headerFrom, reason: 'unaligned' }
  }

  return { authenticated: true, authservId, dmarc, headerFrom, reason: 'pass' }
}

