import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyDuplicateFlags, buildIcsPreview, parseIcsEvents } from './ics-import'

describe('ics-import', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.stubEnv('GOOGLE_AI_API_KEY', '')
  })

  it('parses VEVENT entries from an ICS file', () => {
    const events = parseIcsEvents(`BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:flight-1@example.com
DTSTART:20260410T083000Z
DTEND:20260410T120000Z
SUMMARY:UA 1234 SFO-ORD
LOCATION:SFO
DESCRIPTION:Confirmation ABC123
END:VEVENT
END:VCALENDAR`)

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      uid: 'flight-1@example.com',
      summary: 'UA 1234 SFO-ORD',
      location: 'SFO',
      confirmationCode: 'ABC123',
    })
    expect(events[0].start.date).toBe('2026-04-10')
    expect(events[0].start.timestamp).toBe('2026-04-10T08:30:00Z')
  })

  it('classifies and groups events into trips by date gap', async () => {
    const preview = await buildIcsPreview(`BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:flight-1@example.com
DTSTART:20260410T083000Z
DTEND:20260410T120000Z
SUMMARY:UA 1234 SFO-ORD
LOCATION:SFO
DESCRIPTION:Confirmation ABC123
END:VEVENT
BEGIN:VEVENT
UID:hotel-1@example.com
DTSTART;VALUE=DATE:20260410
DTEND;VALUE=DATE:20260413
SUMMARY:Hotel check-in
LOCATION:Chicago Athletic Association Hotel
DESCRIPTION:Booking reference HJ7890
END:VEVENT
BEGIN:VEVENT
UID:dinner-1@example.com
DTSTART:20260420T190000Z
DTEND:20260420T210000Z
SUMMARY:Dinner reservation
LOCATION:Monteverde
DESCRIPTION:Table for 2
END:VEVENT
END:VCALENDAR`)

    expect(preview.item_count).toBe(3)
    expect(preview.trips).toHaveLength(2)
    expect(preview.trips[0].items).toHaveLength(2)
    expect(preview.trips[0].items.map((item) => item.kind).sort()).toEqual(['flight', 'hotel'])
    expect(preview.trips[1].items[0].kind).toBe('restaurant')
  })

  it('marks duplicates in the preview', async () => {
    const preview = await buildIcsPreview(`BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:flight-1@example.com
DTSTART:20260410T083000Z
DTEND:20260410T120000Z
SUMMARY:UA 1234 SFO-ORD
LOCATION:SFO
END:VEVENT
END:VCALENDAR`)

    const duplicateId = preview.trips[0].items[0].provider_item_id
    const marked = applyDuplicateFlags(preview, new Set([duplicateId]))

    expect(marked.deduped_item_count).toBe(1)
    expect(marked.trips[0].items[0].is_duplicate).toBe(true)
  })
})
