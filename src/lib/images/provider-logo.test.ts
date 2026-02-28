import { describe, expect, it } from 'vitest'

import { extractAirlineCode } from './airline-logo'
import { getProviderLogoUrl, hasProviderLogo } from './provider-logo'

describe('getProviderLogoUrl', () => {
  it('returns airline logo for AF flights', () => {
    expect(getProviderLogoUrl('AF', 'flight')).toBe('https://pics.avs.io/80/80/AF@2x.png')
  })

  it('returns airline logo for DL flights', () => {
    expect(getProviderLogoUrl('DL', 'flight')).toBe('https://pics.avs.io/80/80/DL@2x.png')
  })

  it('returns airline logo for UA flights', () => {
    expect(getProviderLogoUrl('UA', 'flight')).toBe('https://pics.avs.io/80/80/UA@2x.png')
  })

  it('returns airline logo for BA flights', () => {
    expect(getProviderLogoUrl('BA', 'flight')).toBe('https://pics.avs.io/80/80/BA@2x.png')
  })

  it('returns Google favicon fallback for SNCF', () => {
    expect(getProviderLogoUrl('SNCF')).toBe('https://www.google.com/s2/favicons?domain=sncf.com&sz=128')
  })

  it('returns Google favicon fallback for Sixt', () => {
    expect(getProviderLogoUrl('Sixt')).toBe('https://www.google.com/s2/favicons?domain=sixt.com&sz=128')
  })

  it('returns Google favicon fallback for Marriott', () => {
    expect(getProviderLogoUrl('Marriott')).toBe('https://www.google.com/s2/favicons?domain=marriott.com&sz=128')
  })

  it('handles unknown providers gracefully', () => {
    expect(getProviderLogoUrl('Unknown Provider Inc')).toBeNull()
  })

  it('returns null for empty provider string', () => {
    expect(getProviderLogoUrl('')).toBeNull()
  })
})

describe('hasProviderLogo', () => {
  it('returns true for known provider', () => {
    expect(hasProviderLogo('SNCF')).toBe(true)
  })

  it('returns false for unknown provider', () => {
    expect(hasProviderLogo('NoSuchVendor')).toBe(false)
  })
})

describe('extractAirlineCode', () => {
  it('extracts code from compact flight number AF1234', () => {
    expect(extractAirlineCode('AF1234')).toBe('AF')
  })

  it('extracts code from space-delimited flight number DL 567', () => {
    expect(extractAirlineCode('DL 567')).toBe('DL')
  })

  it('returns null for invalid flight string', () => {
    expect(extractAirlineCode('Train 123')).toBeNull()
  })
})
