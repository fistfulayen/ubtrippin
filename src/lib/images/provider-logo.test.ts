import { extractAirlineCode } from './airline-logo'
import { getProviderLogoUrl, hasProviderLogo } from './provider-logo'

describe('getProviderLogoUrl', () => {
  it('returns airline logo URL for Air France flights', () => {
    expect(getProviderLogoUrl('Air France', 'flight')).toBe(
      'https://pics.avs.io/80/80/AF@2x.png'
    )
  })

  it('returns airline logo URL for Delta flights', () => {
    expect(getProviderLogoUrl('Delta', 'flight')).toBe(
      'https://pics.avs.io/80/80/DL@2x.png'
    )
  })

  it('returns airline logo URL for United flights', () => {
    expect(getProviderLogoUrl('United Airlines', 'flight')).toBe(
      'https://pics.avs.io/80/80/UA@2x.png'
    )
  })

  it('returns airline logo URL for British Airways flights', () => {
    expect(getProviderLogoUrl('British Airways', 'flight')).toBe(
      'https://pics.avs.io/80/80/BA@2x.png'
    )
  })

  it('returns Google Favicon fallback for SNCF', () => {
    expect(getProviderLogoUrl('SNCF')).toBe(
      'https://www.google.com/s2/favicons?domain=sncf.com&sz=128'
    )
  })

  it('returns Google Favicon fallback for Sixt', () => {
    expect(getProviderLogoUrl('Sixt')).toBe(
      'https://www.google.com/s2/favicons?domain=sixt.com&sz=128'
    )
  })

  it('returns Google Favicon fallback for Marriott', () => {
    expect(getProviderLogoUrl('Marriott')).toBe(
      'https://www.google.com/s2/favicons?domain=marriott.com&sz=128'
    )
  })

  it('normalizes whitespace and case for domain lookups', () => {
    expect(getProviderLogoUrl('  sNcF Voyageurs  ')).toBe(
      'https://www.google.com/s2/favicons?domain=sncf.com&sz=128'
    )
  })

  it('returns null for unknown providers', () => {
    expect(getProviderLogoUrl('Unknown Provider XYZ')).toBeNull()
  })

  it('returns null for empty provider string', () => {
    expect(getProviderLogoUrl('')).toBeNull()
  })
})

describe('hasProviderLogo', () => {
  it('returns true when a provider has a known logo', () => {
    expect(hasProviderLogo('SNCF')).toBe(true)
  })

  it('returns false when no logo is known', () => {
    expect(hasProviderLogo('Mystery Provider')).toBe(false)
  })
})

describe('extractAirlineCode', () => {
  it('extracts IATA code from AF1234 format', () => {
    expect(extractAirlineCode('AF1234')).toBe('AF')
  })

  it('extracts IATA code when there is whitespace between code and digits', () => {
    expect(extractAirlineCode('DL 567')).toBe('DL')
  })

  it('returns null for non-matching strings', () => {
    expect(extractAirlineCode('NotAFlight')).toBeNull()
  })
})
