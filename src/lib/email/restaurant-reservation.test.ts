import { describe, expect, it } from 'vitest'

import {
  looksLikeRestaurantReservationEmail,
  parseRestaurantReservationEmail,
} from './restaurant-reservation'

describe('restaurant reservation email parser', () => {
  it('parses a reservation acceptance email into a restaurant item', () => {
    const item = parseRestaurantReservationEmail(
      'Reservation Accepted',
      [
        "We've successfully booked your reservation.",
        '',
        'Sushi Azabu',
        'Confirmation # VXT7ZY',
        '',
        'Ian Rogers',
        'Jul 4, 2026 (Sat)',
        '7:45 PM',
        '5 People',
        'Category Counter',
        'Purpose Family',
      ].join('\n')
    )

    expect(item).not.toBeNull()
    expect(item?.kind).toBe('restaurant')
    expect(item?.provider).toBe('Sushi Azabu')
    expect(item?.start_date).toBe('2026-07-04')
    expect(item?.summary).toContain('Sushi Azabu')
    expect(item?.details).toMatchObject({
      restaurant_name: 'Sushi Azabu',
      reservation_time: '19:45',
      party_size: 5,
      seating: 'Counter',
      purpose: 'Family',
      booking_reference: 'VXT7ZY',
    })
  })

  it('rejects unrelated mail', () => {
    expect(looksLikeRestaurantReservationEmail('Hello', 'This is a normal note')).toBe(false)
    expect(parseRestaurantReservationEmail('Hello', 'This is a normal note')).toBeNull()
  })
})
