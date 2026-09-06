import { describe, expect, it } from 'vitest'

import { hasPdfMagic } from './parse-attachment'

describe('hasPdfMagic', () => {
  it('accepts PDF signatures and rejects MIME-only impostors', () => {
    expect(hasPdfMagic(new TextEncoder().encode('%PDF-1.7'))).toBe(true)
    expect(hasPdfMagic(new TextEncoder().encode('<html>'))).toBe(false)
  })
})
