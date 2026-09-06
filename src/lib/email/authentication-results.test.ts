import { describe, expect, it } from 'vitest'

import { verifyInboundAuthentication } from './authentication-results'

describe('verifyInboundAuthentication', () => {
  it('requires a trusted, aligned DMARC pass', () => {
    expect(verifyInboundAuthentication(
      { 'authentication-results': 'mx.resend.test; dmarc=pass header.from=example.com' },
      'traveler@example.com',
      ['mx.resend.test']
    )).toMatchObject({ authenticated: true, reason: 'pass' })
  })

  it.each([
    ['evil.test; dmarc=pass header.from=example.com', 'untrusted_authserv'],
    ['mx.resend.test; dmarc=fail header.from=example.com', 'dmarc_failed'],
    ['mx.resend.test; dmarc=pass header.from=attacker.test', 'unaligned'],
  ])('rejects %s', (value, reason) => {
    expect(verifyInboundAuthentication(
      { 'Authentication-Results': value },
      'traveler@example.com',
      ['mx.resend.test']
    )).toMatchObject({ authenticated: false, reason })
  })
})

