import { describe, expect, it } from 'vitest'

import { resolveSafeRedirectPath } from './auth'

const options = { origin: 'https://www.ubtrippin.xyz', fallbackPath: '/trips' }

describe('resolveSafeRedirectPath', () => {
  it('normalizes an ordinary same-origin path', () => {
    expect(resolveSafeRedirectPath('/trips/123?tab=plan#today', options)).toBe(
      '/trips/123?tab=plan#today'
    )
  })

  it.each([
    '/\\\\evil.example/path',
    '/%5cevil.example/path',
    '%2f%5cevil.example/path',
    '//evil.example/path',
    'https://evil.example/path',
    '/trips%0d%0aLocation:https://evil.example',
  ])('rejects cross-origin or control-bearing value %s', (value) => {
    expect(resolveSafeRedirectPath(value, options)).toBe('/trips')
  })
})
