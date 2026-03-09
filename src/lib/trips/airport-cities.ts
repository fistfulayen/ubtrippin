export interface ResolvedAirportCity {
  city: string
  country: string
  countryCode: string
  metro?: string
}

const AIRPORT_CITIES: Record<string, ResolvedAirportCity> = {
  AMS: { city: 'Amsterdam', country: 'Netherlands', countryCode: 'NL' },
  ATL: { city: 'Atlanta, GA', country: 'United States', countryCode: 'US' },
  AUS: { city: 'Austin, TX', country: 'United States', countryCode: 'US' },
  BCN: { city: 'Barcelona', country: 'Spain', countryCode: 'ES' },
  BER: { city: 'Berlin', country: 'Germany', countryCode: 'DE' },
  BOS: { city: 'Boston, MA', country: 'United States', countryCode: 'US' },
  CDG: { city: 'Paris', country: 'France', countryCode: 'FR', metro: 'PAR' },
  CHS: { city: 'Charleston, SC', country: 'United States', countryCode: 'US' },
  DEN: { city: 'Denver, CO', country: 'United States', countryCode: 'US' },
  DFW: { city: 'Dallas, TX', country: 'United States', countryCode: 'US' },
  DTW: { city: 'Detroit, MI', country: 'United States', countryCode: 'US' },
  EWR: { city: 'New York', country: 'United States', countryCode: 'US', metro: 'NYC' },
  FCO: { city: 'Rome', country: 'Italy', countryCode: 'IT' },
  FLL: { city: 'Fort Lauderdale, FL', country: 'United States', countryCode: 'US' },
  HND: { city: 'Tokyo', country: 'Japan', countryCode: 'JP', metro: 'TYO' },
  ICN: { city: 'Seoul', country: 'South Korea', countryCode: 'KR' },
  JFK: { city: 'New York', country: 'United States', countryCode: 'US', metro: 'NYC' },
  LAX: { city: 'Los Angeles, CA', country: 'United States', countryCode: 'US' },
  LGA: { city: 'New York', country: 'United States', countryCode: 'US', metro: 'NYC' },
  LHR: { city: 'London', country: 'United Kingdom', countryCode: 'GB', metro: 'LON' },
  LIN: { city: 'Milan', country: 'Italy', countryCode: 'IT', metro: 'MIL' },
  MDW: { city: 'Chicago', country: 'United States', countryCode: 'US', metro: 'CHI' },
  MIA: { city: 'Miami, FL', country: 'United States', countryCode: 'US' },
  MSP: { city: 'Minneapolis, MN', country: 'United States', countryCode: 'US' },
  MXP: { city: 'Milan', country: 'Italy', countryCode: 'IT', metro: 'MIL' },
  NCE: { city: 'Nice', country: 'France', countryCode: 'FR' },
  NRT: { city: 'Tokyo', country: 'Japan', countryCode: 'JP', metro: 'TYO' },
  ORD: { city: 'Chicago', country: 'United States', countryCode: 'US', metro: 'CHI' },
  ORY: { city: 'Paris', country: 'France', countryCode: 'FR', metro: 'PAR' },
  PDX: { city: 'Portland, OR', country: 'United States', countryCode: 'US' },
  PEK: { city: 'Beijing', country: 'China', countryCode: 'CN' },
  PHX: { city: 'Phoenix, AZ', country: 'United States', countryCode: 'US' },
  PSP: { city: 'Palm Springs, CA', country: 'United States', countryCode: 'US' },
  SAN: { city: 'San Diego, CA', country: 'United States', countryCode: 'US' },
  SEA: { city: 'Seattle, WA', country: 'United States', countryCode: 'US' },
  SCL: { city: 'Santiago', country: 'Chile', countryCode: 'CL' },
  SFO: { city: 'San Francisco, CA', country: 'United States', countryCode: 'US' },
  SRQ: { city: 'Sarasota, FL', country: 'United States', countryCode: 'US' },
  STN: { city: 'London', country: 'United Kingdom', countryCode: 'GB', metro: 'LON' },
  SXM: { city: 'Sint Maarten', country: 'Sint Maarten', countryCode: 'SX' },
  TLL: { city: 'Tallinn', country: 'Estonia', countryCode: 'EE' },
  TPA: { city: 'Tampa, FL', country: 'United States', countryCode: 'US' },
  TRN: { city: 'Turin', country: 'Italy', countryCode: 'IT' },
}

export function resolveAirportCity(code: string): ResolvedAirportCity | null {
  return AIRPORT_CITIES[code.trim().toUpperCase()] ?? null
}

/**
 * Metro area aliases: city names / neighborhoods that belong to the same metro.
 * Used to prevent false-positive hotel reassignment (e.g. Coconut Grove ≠ Miami
 * by string, but same metro area).
 */
const METRO_ALIASES: Record<string, string> = {
  'newark': 'new york',
  'jersey city': 'new york',
  'hoboken': 'new york',
  'brooklyn': 'new york',
  'queens': 'new york',
  'bronx': 'new york',
  'coconut grove': 'miami',
  'surfside': 'miami',
  'miami beach': 'miami',
  'fort lauderdale': 'miami',
  'coral gables': 'miami',
  'orly': 'paris',
  'roissy': 'paris',
  'gatwick': 'london',
  'stansted': 'london',
  'luton': 'london',
  'narita': 'tokyo',
  'haneda': 'tokyo',
  'san francisco': 'san francisco bay',
  'oakland': 'san francisco bay',
  'san jose': 'san francisco bay',
  'berkeley': 'san francisco bay',
  'palo alto': 'san francisco bay',
}

/**
 * Resolve a city name to its metro canonical name if it's a known alias.
 * Returns the canonical name (lowercase) or the input key unchanged.
 */
/**
 * Resolve a city name to its metro canonical name if it's a known alias.
 * Extracts city part before comma (e.g. "Newark, NJ" → "newark").
 * Returns the canonical name (lowercase) or the normalized city name.
 */
export function resolveMetroAlias(cityName: string): string {
  const key = cityName.split(',')[0].toLowerCase().replace(/[^a-z\s]+/g, '').trim()
  return METRO_ALIASES[key] ?? key
}

export function isSameMetroArea(code1: string, code2: string): boolean {
  const left = resolveAirportCity(code1)
  const right = resolveAirportCity(code2)
  if (!left || !right) return false
  if (left.metro && right.metro) return left.metro === right.metro
  return code1.trim().toUpperCase() === code2.trim().toUpperCase()
}
