import { afterEach, describe, expect, it } from 'vitest'

import { normalizeCoverImageUrl } from './cover-url'

const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

afterEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl
})

describe('normalizeCoverImageUrl', () => {
  it('allows trusted image sources', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
    expect(normalizeCoverImageUrl('https://images.unsplash.com/photo-1')).toBe(
      'https://images.unsplash.com/photo-1'
    )
    expect(
      normalizeCoverImageUrl(
        'https://project.supabase.co/storage/v1/object/public/trip-images/user/trip.jpg'
      )
    ).toBe(
      'https://project.supabase.co/storage/v1/object/public/trip-images/user/trip.jpg'
    )
  })

  it('rejects arbitrary and internal URLs', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
    expect(normalizeCoverImageUrl('https://127.0.0.1/secret.png')).toBeNull()
    expect(normalizeCoverImageUrl('https://attacker.example/image.png')).toBeNull()
    expect(
      normalizeCoverImageUrl('https://project.supabase.co/storage/v1/object/private/secret')
    ).toBeNull()
  })
})
