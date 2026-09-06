import { describe, expect, it } from 'vitest'

import { sanitizeItem, sanitizePublicItemDetails } from './sanitize'

describe('shared item sanitizers', () => {
  it('recursively removes booking secrets and storage locators', () => {
    const output = sanitizeItem({
      id: 'item-1',
      confirmation_code: 'ABC123',
      source_email_id: 'email-1',
      details_json: {
        nested: { booking_reference: 'SECRET', ticket_pdf_path: 'victim/path.pdf' },
        departure_local_time: '10:00',
      },
    })

    expect(output).toEqual({
      id: 'item-1',
      details_json: { nested: {}, departure_local_time: '10:00' },
    })
  })

  it('uses a per-kind allowlist for public sharing', () => {
    expect(sanitizePublicItemDetails('flight', {
      flight_number: 'UA123',
      departure_local_time: '10:00',
      seat: '2A',
      contact_phone: '+1 555 1234',
      ticket_pdf_bucket: 'email-attachments',
    })).toEqual({ flight_number: 'UA123', departure_local_time: '10:00' })
  })
})
