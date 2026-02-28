import { NextResponse } from 'next/server'
import { describe, expect, it } from 'vitest'

import { hashApiKey, isAuthError, type AuthResult } from './auth'

describe('hashApiKey', () => {
  it('produces consistent SHA-256 output for the same input', () => {
    const key = 'test-key-123'
    expect(hashApiKey(key)).toBe(hashApiKey(key))
  })

  it('matches known SHA-256 value', () => {
    expect(hashApiKey('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('produces different hashes for different inputs', () => {
    expect(hashApiKey('key-one')).not.toBe(hashApiKey('key-two'))
  })

  it('returns 64-char lowercase hex digest', () => {
    expect(hashApiKey('sample')).toMatch(/^[a-f0-9]{64}$/)
  })

  it('handles empty string input', () => {
    expect(hashApiKey('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })

  it('treats whitespace as meaningful input', () => {
    expect(hashApiKey(' ')).not.toBe(hashApiKey(''))
    expect(hashApiKey('  ')).not.toBe(hashApiKey(' '))
  })

  it('handles special characters', () => {
    expect(hashApiKey('!@#$%^&*()_+-=[]{}|;:\",.<>/?`~')).toMatch(/^[a-f0-9]{64}$/)
  })
})

describe('isAuthError', () => {
  it('returns true for NextResponse', () => {
    const response = NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    expect(isAuthError(response)).toBe(true)
  })

  it('returns false for AuthResult', () => {
    const authResult: AuthResult = { userId: 'user-1', keyHash: hashApiKey('abc') }
    expect(isAuthError(authResult)).toBe(false)
  })
})
