/**
 * Maps IATA airport codes to city names for better image searches.
 * When searching for destination images, we want "Tokyo" not "HND".
 */
export const AIRPORT_TO_CITY: Record<string, string> = {
  // Major US Airports
  JFK: 'New York City',
  LGA: 'New York City',
  EWR: 'New York City',
  LAX: 'Los Angeles',
  SFO: 'San Francisco',
  ORD: 'Chicago',
  MDW: 'Chicago',
  DFW: 'Dallas',
  DEN: 'Denver',
  SEA: 'Seattle',
  MIA: 'Miami',
  ATL: 'Atlanta',
  BOS: 'Boston',
  IAD: 'Washington DC',
  DCA: 'Washington DC',
  PHX: 'Phoenix',
  LAS: 'Las Vegas',
  SAN: 'San Diego',
  PDX: 'Portland Oregon',
  MSP: 'Minneapolis',
  DTW: 'Detroit',
  PHL: 'Philadelphia',
  CLT: 'Charlotte',
  MCO: 'Orlando',
  TPA: 'Tampa',
  AUS: 'Austin Texas',
  SLC: 'Salt Lake City',
  HNL: 'Honolulu Hawaii',

  // Major European Airports
  CDG: 'Paris',
  ORY: 'Paris',
  LHR: 'London',
  LGW: 'London',
  STN: 'London',
  LCY: 'London',
  AMS: 'Amsterdam',
  FRA: 'Frankfurt',
  MUC: 'Munich',
  BER: 'Berlin',
  FCO: 'Rome',
  MXP: 'Milan',
  LIN: 'Milan',
  MAD: 'Madrid',
  BCN: 'Barcelona',
  ZRH: 'Zurich',
  GVA: 'Geneva',
  VIE: 'Vienna',
  CPH: 'Copenhagen',
  ARN: 'Stockholm',
  OSL: 'Oslo',
  HEL: 'Helsinki',
  DUB: 'Dublin',
  LIS: 'Lisbon',
  ATH: 'Athens',
  IST: 'Istanbul',
  PRG: 'Prague',
  BRU: 'Brussels',
  WAW: 'Warsaw',

  // UK Regional
  MAN: 'Manchester UK',
  EDI: 'Edinburgh',
  GLA: 'Glasgow',
  BHX: 'Birmingham UK',

  // Asian Airports
  HND: 'Tokyo',
  NRT: 'Tokyo',
  KIX: 'Osaka',
  NGO: 'Nagoya',
  CTS: 'Sapporo',
  FUK: 'Fukuoka',
  HKG: 'Hong Kong',
  PEK: 'Beijing',
  PVG: 'Shanghai',
  SHA: 'Shanghai',
  ICN: 'Seoul',
  GMP: 'Seoul',
  SIN: 'Singapore',
  BKK: 'Bangkok',
  KUL: 'Kuala Lumpur',
  CGK: 'Jakarta',
  DEL: 'New Delhi',
  BOM: 'Mumbai',
  TPE: 'Taipei',
  MNL: 'Manila',
  SGN: 'Ho Chi Minh City',
  HAN: 'Hanoi',

  // Middle East
  DXB: 'Dubai',
  AUH: 'Abu Dhabi',
  DOH: 'Doha',
  TLV: 'Tel Aviv',
  RUH: 'Riyadh',
  JED: 'Jeddah',

  // Oceania
  SYD: 'Sydney',
  MEL: 'Melbourne',
  BNE: 'Brisbane',
  PER: 'Perth Australia',
  AKL: 'Auckland',
  WLG: 'Wellington',

  // Canada
  YYZ: 'Toronto',
  YVR: 'Vancouver',
  YUL: 'Montreal',
  YYC: 'Calgary',
  YOW: 'Ottawa',

  // Latin America
  MEX: 'Mexico City',
  CUN: 'Cancun',
  GRU: 'São Paulo',
  GIG: 'Rio de Janeiro',
  EZE: 'Buenos Aires',
  SCL: 'Santiago Chile',
  BOG: 'Bogotá',
  LIM: 'Lima',
  PTY: 'Panama City',

  // Africa
  JNB: 'Johannesburg',
  CPT: 'Cape Town',
  CAI: 'Cairo',
  CMN: 'Casablanca',
  ADD: 'Addis Ababa',
  NBO: 'Nairobi',
  LOS: 'Lagos',
}

/**
 * Converts a location string to a city name suitable for image search.
 * Handles airport codes, "City (CODE)" format, and plain city names.
 */
export function locationToCity(location: string): string {
  if (!location) return ''

  const trimmed = location.trim()

  // Check if it's a pure airport code (3 uppercase letters)
  if (/^[A-Z]{3}$/.test(trimmed)) {
    return AIRPORT_TO_CITY[trimmed] || trimmed
  }

  // Check for "City (CODE)" or "CODE - City" patterns
  const codeInParens = trimmed.match(/^(.+?)\s*\(([A-Z]{3})\)$/)
  if (codeInParens) {
    // Prefer the city name if it looks like a real city
    const cityPart = codeInParens[1].trim()
    if (cityPart.length > 3 && !/^[A-Z]{3}$/.test(cityPart)) {
      return cityPart
    }
    return AIRPORT_TO_CITY[codeInParens[2]] || cityPart
  }

  const codePrefix = trimmed.match(/^([A-Z]{3})\s*[-–]\s*(.+)$/)
  if (codePrefix) {
    const cityPart = codePrefix[2].trim()
    if (cityPart.length > 3) {
      return cityPart
    }
    return AIRPORT_TO_CITY[codePrefix[1]] || cityPart
  }

  // If it looks like an airport code at the start, try to map it
  const startsWithCode = trimmed.match(/^([A-Z]{3})\b/)
  if (startsWithCode && AIRPORT_TO_CITY[startsWithCode[1]]) {
    return AIRPORT_TO_CITY[startsWithCode[1]]
  }

  // Return as-is (already a city name)
  return trimmed
}
