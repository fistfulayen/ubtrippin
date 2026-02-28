/**
 * Airline logo system using pics.avs.io (free, no auth, IATA code based)
 * Format: https://pics.avs.io/{width}/{height}/{IATA_CODE}.png
 * 
 * Clearbit Logo API shut down Dec 8, 2025. This replaces it.
 */

// Map airline names (as they appear in provider field) to IATA codes
const AIRLINE_IATA: Record<string, string> = {
  // US Airlines
  'united airlines': 'UA',
  'united': 'UA',
  'delta air lines': 'DL',
  'delta airlines': 'DL',
  'delta': 'DL',
  'american airlines': 'AA',
  'american': 'AA',
  'southwest airlines': 'WN',
  'southwest': 'WN',
  'jetblue airways': 'B6',
  'jetblue': 'B6',
  'alaska airlines': 'AS',
  'alaska': 'AS',
  'spirit airlines': 'NK',
  'spirit': 'NK',
  'frontier airlines': 'F9',
  'frontier': 'F9',
  'hawaiian airlines': 'HA',
  'hawaiian': 'HA',
  'sun country airlines': 'SY',
  'sun country': 'SY',
  'allegiant air': 'G4',
  'allegiant': 'G4',

  // European Airlines
  'british airways': 'BA',
  'lufthansa': 'LH',
  'air france': 'AF',
  'airfrance': 'AF',
  'klm': 'KL',
  'klm royal dutch airlines': 'KL',
  'ryanair': 'FR',
  'easyjet': 'U2',
  'easy jet': 'U2',
  'swiss': 'LX',
  'swiss international air lines': 'LX',
  'iberia': 'IB',
  'tap air portugal': 'TP',
  'tap portugal': 'TP',
  'tap': 'TP',
  'alitalia': 'AZ',
  'ita airways': 'AZ',
  'ita': 'AZ',
  'vueling': 'VY',
  'finnair': 'AY',
  'aer lingus': 'EI',
  'norwegian': 'DY',
  'norwegian air shuttle': 'DY',
  'sas': 'SK',
  'scandinavian airlines': 'SK',
  'wizz air': 'W6',
  'wizzair': 'W6',
  'eurowings': 'EW',
  'transavia': 'HV',
  'aegean airlines': 'A3',
  'aegean': 'A3',
  'airbaltic': 'BT',
  'air baltic': 'BT',
  'air france hop': 'A5',
  'hop!': 'A5',
  'la compagnie': 'B0',
  'play': 'OG',
  'widerøe': 'WF',
  'flybe': 'BE',
  'air dolomiti': 'EN',
  'air corsica': 'XK',
  'air nostrum': 'YW',
  'cityjet': 'WX',
  'luxair': 'LG',
  'tarom': 'RO',
  'croatia airlines': 'OU',
  'air serbia': 'JU',
  'air malta': 'KM',
  'air europa': 'UX',
  'tunisair': 'TU',
  'lot polish airlines': 'LO',
  'lot': 'LO',
  'icelandair': 'FI',
  'turkish airlines': 'TK',
  'turkish': 'TK',
  'austrian airlines': 'OS',
  'austrian': 'OS',
  'brussels airlines': 'SN',
  'condor': 'DE',
  'pegasus airlines': 'PC',
  'pegasus': 'PC',

  // Middle East
  'emirates': 'EK',
  'qatar airways': 'QR',
  'qatar': 'QR',
  'etihad airways': 'EY',
  'etihad': 'EY',
  'saudi arabian airlines': 'SV',
  'saudia': 'SV',
  'royal jordanian': 'RJ',
  'gulf air': 'GF',
  'oman air': 'WY',
  'el al': 'LY',

  // Asian Airlines
  'singapore airlines': 'SQ',
  'singapore': 'SQ',
  'cathay pacific': 'CX',
  'cathay': 'CX',
  'japan airlines': 'JL',
  'jal': 'JL',
  'ana': 'NH',
  'all nippon airways': 'NH',
  'korean air': 'KE',
  'asiana airlines': 'OZ',
  'asiana': 'OZ',
  'thai airways': 'TG',
  'thai': 'TG',
  'air india': 'AI',
  'malaysia airlines': 'MH',
  'garuda indonesia': 'GA',
  'vietnam airlines': 'VN',
  'china airlines': 'CI',
  'eva air': 'BR',
  'philippine airlines': 'PR',
  'airasia': 'AK',
  'air asia': 'AK',
  'scoot': 'TR',
  'cebu pacific': '5J',
  'indigo': '6E',

  // Oceania
  'qantas': 'QF',
  'air new zealand': 'NZ',
  'virgin australia': 'VA',
  'jetstar': 'JQ',

  // Americas (non-US)
  'air canada': 'AC',
  'westjet': 'WS',
  'copa airlines': 'CM',
  'avianca': 'AV',
  'latam airlines': 'LA',
  'latam': 'LA',
  'azul brazilian airlines': 'AD',
  'azul': 'AD',
  'gol': 'G3',
  'aeromexico': 'AM',
  'volaris': 'Y4',

  // African Airlines
  'ethiopian airlines': 'ET',
  'south african airways': 'SA',
  'kenya airways': 'KQ',
  'royal air maroc': 'AT',
  'egyptair': 'MS',
}

/**
 * Get airline logo URL from airline name or IATA code.
 * Uses pics.avs.io — free, no auth, reliable.
 */
export function getAirlineLogoUrl(airlineNameOrCode: string): string | null {
  if (!airlineNameOrCode) return null

  const normalized = airlineNameOrCode.trim().toLowerCase()

  // Direct IATA code lookup (2-letter)
  if (/^[a-z0-9]{2}$/i.test(airlineNameOrCode.trim())) {
    return `https://pics.avs.io/80/80/${airlineNameOrCode.trim().toUpperCase()}@2x.png`
  }

  // Name lookup
  const iata = AIRLINE_IATA[normalized]
  if (iata) {
    return `https://pics.avs.io/80/80/${iata}@2x.png`
  }

  return null
}

/**
 * Extract IATA airline code from a flight number (e.g., "AF1234" → "AF")
 */
export function extractAirlineCode(flightNumber: string): string | null {
  const match = flightNumber.trim().toUpperCase().match(/^([A-Z]{2})\s*\d/)
  return match ? match[1] : null
}
