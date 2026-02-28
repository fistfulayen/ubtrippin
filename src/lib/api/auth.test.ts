import { createHash } from 'crypto'
import { NextResponse } from 'next/server'

import { hashApiKey, isAuthError, type AuthResult } from './auth'

describe('hashApiKey', () => {
  it('produces consistent SHA-256 hex output for the same input', () => {
    const input = 'test-api-key'
    const first = hashApiKey(input)
    const second = hashApiKey(input)

    expect(first).toBe(second)
    expect(first).toMatch(/^[a-f0-9]{64}$/)
  })

  it('matches Node crypto SHA-256 output', () => {
    const input = 'ubtrippin-key'
    const expected = createHash('sha256').update(input).digest('hex')

    expect(hashApiKey(input)).toBe(expected)
  })

  it('produces different hashes for different inputs', () => {
    expect(hashApiKey('alpha')).not.toBe(hashApiKey('beta'))
  })

  it('handles empty string input', () => {
    const result = hashApiKey('')
    expect(result).toMatch(/^[a-f0-9]{64}$/)
  })

  it('handles whitespace-only input', () => {
    const result = hashApiKey('   ')
    expect(result).toMatch(/^[a-f0-9]{64}$/)
    expect(result).not.toBe(hashApiKey(''))
  })

  it('handles special characters input', () => {
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>/?`~'
    const result = hashApiKey(special)

    expect(result).toMatch(/^[a-f0-9]{64}$/)
  })
})

describe('isAuthError', () => {
  it('returns true for NextResponse', () => {
    const response = NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    expect(isAuthError(response)).toBe(true)
  })

  it('returns false for AuthResult', () => {
    const success: AuthResult = {
      userId: 'user-123',
      keyHash: hashApiKey('key-123'),
    }

    expect(isAuthError(success)).toBe(false)
  })
})
