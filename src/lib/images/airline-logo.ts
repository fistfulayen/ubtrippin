// Map of common airline names to their domains
const AIRLINE_DOMAINS: Record<string, string> = {
  // US Airlines
  'united airlines': 'united.com',
  'united': 'united.com',
  'delta air lines': 'delta.com',
  'delta': 'delta.com',
  'american airlines': 'aa.com',
  'american': 'aa.com',
  'southwest airlines': 'southwest.com',
  'southwest': 'southwest.com',
  'jetblue airways': 'jetblue.com',
  'jetblue': 'jetblue.com',
  'alaska airlines': 'alaskaair.com',
  'alaska': 'alaskaair.com',
  'spirit airlines': 'spirit.com',
  'spirit': 'spirit.com',
  'frontier airlines': 'flyfrontier.com',
  'frontier': 'flyfrontier.com',
  'hawaiian airlines': 'hawaiianairlines.com',
  'hawaiian': 'hawaiianairlines.com',

  // European Airlines
  'british airways': 'britishairways.com',
  'lufthansa': 'lufthansa.com',
  'air france': 'airfrance.com',
  'klm': 'klm.com',
  'ryanair': 'ryanair.com',
  'easyjet': 'easyjet.com',
  'swiss': 'swiss.com',
  'iberia': 'iberia.com',
  'tap portugal': 'flytap.com',
  'tap air portugal': 'flytap.com',
  'scandinavian airlines': 'flysas.com',
  'sas': 'flysas.com',
  'finnair': 'finnair.com',
  'austrian airlines': 'austrian.com',
  'austrian': 'austrian.com',
  'aer lingus': 'aerlingus.com',
  'vueling': 'vueling.com',

  // Asian Airlines
  'emirates': 'emirates.com',
  'qatar airways': 'qatarairways.com',
  'qatar': 'qatarairways.com',
  'etihad airways': 'etihad.com',
  'etihad': 'etihad.com',
  'singapore airlines': 'singaporeair.com',
  'cathay pacific': 'cathaypacific.com',
  'ana': 'ana.co.jp',
  'all nippon airways': 'ana.co.jp',
  'jal': 'jal.co.jp',
  'japan airlines': 'jal.co.jp',
  'korean air': 'koreanair.com',
  'asiana airlines': 'flyasiana.com',
  'asiana': 'flyasiana.com',
  'thai airways': 'thaiairways.com',
  'thai': 'thaiairways.com',
  'malaysia airlines': 'malaysiaairlines.com',

  // Other
  'qantas': 'qantas.com',
  'air canada': 'aircanada.com',
  'westjet': 'westjet.com',
  'latam': 'latam.com',
  'latam airlines': 'latam.com',
  'avianca': 'avianca.com',
  'air new zealand': 'airnewzealand.com',
  'virgin atlantic': 'virginatlantic.com',
  'virgin australia': 'virginaustralia.com',
}

// IATA airline codes to domains
const AIRLINE_CODES: Record<string, string> = {
  'ua': 'united.com',
  'dl': 'delta.com',
  'aa': 'aa.com',
  'wn': 'southwest.com',
  'b6': 'jetblue.com',
  'as': 'alaskaair.com',
  'nk': 'spirit.com',
  'f9': 'flyfrontier.com',
  'ha': 'hawaiianairlines.com',
  'ba': 'britishairways.com',
  'lh': 'lufthansa.com',
  'af': 'airfrance.com',
  'kl': 'klm.com',
  'fr': 'ryanair.com',
  'u2': 'easyjet.com',
  'lx': 'swiss.com',
  'ib': 'iberia.com',
  'tp': 'flytap.com',
  'sk': 'flysas.com',
  'ay': 'finnair.com',
  'os': 'austrian.com',
  'ei': 'aerlingus.com',
  'vy': 'vueling.com',
  'ek': 'emirates.com',
  'qr': 'qatarairways.com',
  'ey': 'etihad.com',
  'sq': 'singaporeair.com',
  'cx': 'cathaypacific.com',
  'nh': 'ana.co.jp',
  'jl': 'jal.co.jp',
  'ke': 'koreanair.com',
  'oz': 'flyasiana.com',
  'tg': 'thaiairways.com',
  'mh': 'malaysiaairlines.com',
  'qf': 'qantas.com',
  'ac': 'aircanada.com',
  'ws': 'westjet.com',
  'la': 'latam.com',
  'av': 'avianca.com',
  'nz': 'airnewzealand.com',
  'vs': 'virginatlantic.com',
  'va': 'virginaustralia.com',
}

/**
 * Returns a Clearbit logo URL for an airline.
 * Returns null if the airline is not recognized.
 */
export function getAirlineLogoUrl(airlineName: string): string | null {
  if (!airlineName) return null

  // Normalize: lowercase, remove spaces, trim
  const normalized = airlineName.toLowerCase().trim()

  // Try exact match first
  let domain = AIRLINE_DOMAINS[normalized]

  // Try without spaces (e.g., "AirFrance" -> "airfrance")
  if (!domain) {
    const noSpaces = normalized.replace(/\s+/g, '')
    domain = AIRLINE_DOMAINS[noSpaces]
  }

  // Try adding space before "air" or "airlines" (e.g., "airfrance" -> "air france")
  if (!domain) {
    const withSpace = normalized
      .replace(/^air(?!lines)/, 'air ')
      .replace(/airlines$/, ' airlines')
      .replace(/\s+/g, ' ')
      .trim()
    domain = AIRLINE_DOMAINS[withSpace]
  }

  // Try IATA code (first 2 chars of flight number often)
  if (!domain && normalized.length === 2) {
    domain = AIRLINE_CODES[normalized]
  }

  if (!domain) return null

  return `https://logo.clearbit.com/${domain}`
}
