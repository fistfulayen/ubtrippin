import { describe, expect, it } from 'vitest'

import {
  extractIataCodeFromFlightString,
  extractProviderFromSubject,
  normalizeDateForTest,
  parseDateParts,
} from './extract-travel-data'

describe('parseDateParts', () => {
  it('parses ISO dates', () => {
    expect(parseDateParts('2026-03-15', 2026)).toEqual({ year: 2026, month: 3, day: 15 })
  })

  it('parses month name format without year using fallback', () => {
    expect(parseDateParts('Mar 15', 2026)).toEqual({ year: 2026, month: 3, day: 15 })
  })

  it('parses day-first month format', () => {
    expect(parseDateParts('15 March 2027', 2026)).toEqual({ year: 2027, month: 3, day: 15 })
  })

  it('parses numeric US-style date', () => {
    expect(parseDateParts('03/15/2026', 2025)).toEqual({ year: 2026, month: 3, day: 15 })
  })

  it('parses numeric day-first date when first number is > 12', () => {
    expect(parseDateParts('15/03/2026', 2025)).toEqual({ year: 2026, month: 3, day: 15 })
  })

  it('returns null for invalid dates', () => {
    expect(parseDateParts('not-a-date', 2026)).toBeNull()
  })
})

describe('normalizeDateForTest', () => {
  it('keeps explicit year from source text', () => {
    const result = normalizeDateForTest(
      'Mar 15 2025',
      new Date('2026-01-10T00:00:00.000Z'),
      'Your booking is on Mar 15 2025'
    )
    expect(result).toBe('2025-03-15')
  })

  it('infers next upcoming occurrence when year is missing and date is still upcoming', () => {
    const result = normalizeDateForTest(
      'Mar 15',
      new Date('2026-01-10T00:00:00.000Z'),
      'Your booking is on Mar 15 at 19:00'
    )
    expect(result).toBe('2026-03-15')
  })

  it('infers next year when year is missing and date has passed', () => {
    const result = normalizeDateForTest(
      'Jan 05',
      new Date('2026-02-10T00:00:00.000Z'),
      'Train departs Jan 05 at 08:00'
    )
    expect(result).toBe('2027-01-05')
  })

  it('returns null for impossible date', () => {
    const result = normalizeDateForTest(
      'Feb 30',
      new Date('2026-01-01T00:00:00.000Z'),
      'Departure Feb 30'
    )
    expect(result).toBeNull()
  })
})

describe('extractProviderFromSubject', () => {
  it('extracts provider after with/on/from patterns', () => {
    expect(extractProviderFromSubject('Your itinerary with Air France is confirmed')).toBe('Air France')
  })

  it('extracts provider before booking keyword', () => {
    expect(extractProviderFromSubject('SNCF booking confirmation #ABC123')).toBe('SNCF')
  })

  it('returns null for empty subject', () => {
    expect(extractProviderFromSubject('   ')).toBeNull()
  })
})

describe('extractIataCodeFromFlightString', () => {
  it('extracts AF from AF1234', () => {
    expect(extractIataCodeFromFlightString('AF1234')).toBe('AF')
  })

  it('extracts DL from DL 567', () => {
    expect(extractIataCodeFromFlightString('DL 567')).toBe('DL')
  })

  it('returns null for non-flight strings', () => {
    expect(extractIataCodeFromFlightString('Train to Paris')).toBeNull()
  })
})
