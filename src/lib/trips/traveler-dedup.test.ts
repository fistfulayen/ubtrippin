import { describe, expect, it } from 'vitest'
import { deduplicateTravelers } from './traveler-dedup'

describe('deduplicateTravelers', () => {
  it('strips honorifics and suffixes and prefers the longest canonical variant', () => {
    expect(
      deduplicateTravelers([' mr. jane q doe ', 'Jane Doe', 'Jane Q. Doe Jr.'])
    ).toEqual(['Jane Q Doe'])
  })

  it('merges minor spelling differences', () => {
    expect(deduplicateTravelers(['Jon Smith', 'John Smith', 'John  Smith'])).toEqual(['John Smith'])
  })

  it('keeps clearly different people separate', () => {
    expect(deduplicateTravelers(['Jane Doe', 'Janet Doe', 'John Doe'])).toEqual([
      'Jane Doe',
      'Janet Doe',
      'John Doe',
    ])
  })
})
