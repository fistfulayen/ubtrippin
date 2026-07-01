import { describe, expect, it } from 'vitest'

import { buildFlightIdent, extractFlightIdentsFromDetails } from './flight-ident'

describe('flight-ident parsing', () => {
  it('returns the first leg for multi-leg flight numbers', () => {
    const details = {
      airline: 'Etihad Airways',
      flight_number: 'EY 32, EY 800',
    }

    expect(buildFlightIdent(details)).toBe('EY32')
  })

  it('splits multi-leg flight numbers into separate idents', () => {
    const details = {
      airline: 'Etihad Airways',
      flight_number: 'EY 32 / EY 800',
    }

    expect(extractFlightIdentsFromDetails(details)).toEqual(['EY32', 'EY800'])
  })

  it('prefixes digits-only multi-leg numbers with the airline code', () => {
    const details = {
      airline: 'Etihad Airways',
      flight_number: '32, 800',
    }

    expect(extractFlightIdentsFromDetails(details)).toEqual(['EY32', 'EY800'])
  })
})
