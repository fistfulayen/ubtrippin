/**
 * Client-safe utility for building flight ident strings and live page URLs.
 * No server-only dependencies (no process.env, no node imports).
 */

// Common airline name → IATA code mapping
const AIRLINE_IATA: Record<string, string> = {
  'air france': 'AF',
  'air france hop': 'HOP',
  'hop': 'A5',
  'hop!': 'A5',
  'delta': 'DL',
  'delta air lines': 'DL',
  'united': 'UA',
  'united airlines': 'UA',
  'american': 'AA',
  'american airlines': 'AA',
  'british airways': 'BA',
  'lufthansa': 'LH',
  'klm': 'KL',
  'easyjet': 'U2',
  'ryanair': 'FR',
  'vueling': 'VY',
  'iberia': 'IB',
  'swiss': 'LX',
  'austrian': 'OS',
  'transavia': 'TO',
  'alitalia': 'AZ',
  'ita airways': 'AZ',
  'tap': 'TP',
  'tap portugal': 'TP',
  'sas': 'SK',
  'finnair': 'AY',
  'turkish airlines': 'TK',
  'emirates': 'EK',
  'qatar': 'QR',
  'qatar airways': 'QR',
  'etihad': 'EY',
  'singapore airlines': 'SQ',
  'cathay pacific': 'CX',
  'ana': 'NH',
  'jal': 'JL',
  'japan airlines': 'JL',
  'korean air': 'KE',
  'spirit': 'NK',
  'spirit airlines': 'NK',
  'jetblue': 'B6',
  'jetblue airways': 'B6',
  'southwest': 'WN',
  'southwest airlines': 'WN',
  'frontier': 'F9',
  'frontier airlines': 'F9',
  'alaska': 'AS',
  'alaska airlines': 'AS',
  'norwegian': 'DY',
  'wizz air': 'W6',
  'volotea': 'V7',
  'aer lingus': 'EI',
}

/**
 * Build the flight ident string (e.g. "NK457") from flight details.
 * Returns null if we can't determine the ident.
 */
export function buildFlightIdent(details: Record<string, unknown> | null | undefined): string | null {
  if (!details) return null

  const rawFlightNumber = typeof details.flight_number === 'string' ? details.flight_number : null
  if (!rawFlightNumber) return null

  const normalized = rawFlightNumber.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (normalized.length < 2 || normalized.length > 8) return null
  if (!/\d/.test(normalized)) return null

  // If flight number already has letters (e.g. "AA2400"), use as-is
  if (/[A-Z]/.test(normalized)) return normalized

  // Digits-only — need airline prefix
  const airline = typeof details.airline === 'string' ? details.airline : null
  const code = typeof details.airline_code === 'string'
    ? details.airline_code
    : typeof details.carrier_code === 'string'
    ? details.carrier_code
    : null

  if (code && /^[A-Z0-9]{2}$/i.test(code.trim())) {
    return code.trim().toUpperCase() + normalized
  }

  if (airline) {
    const iata = AIRLINE_IATA[airline.toLowerCase().trim()]
    if (iata) return iata + normalized
  }

  return null
}

/**
 * Build the URL path for the live flight page.
 * Returns null if we can't determine the flight ident.
 */
export function buildFlightPageUrl(
  details: Record<string, unknown> | null | undefined,
  startDate: string | null | undefined
): string | null {
  if (!startDate) return null
  const ident = buildFlightIdent(details)
  if (!ident) return null
  return `/flights/${ident}/${startDate}`
}
