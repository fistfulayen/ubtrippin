// Map of common airline names to their domains
const AIRLINE_DOMAINS: Record<string, string> = {
  // US Airlines
  'united airlines': 'united.com',
  'united': 'united.com',
  'delta air lines': 'delta.com',
  'delta airlines': 'delta.com',
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
  'sun country airlines': 'suncountry.com',
  'sun country': 'suncountry.com',
  'allegiant air': 'allegiantair.com',
  'allegiant': 'allegiantair.com',

  // European Airlines
  'british airways': 'britishairways.com',
  'lufthansa': 'lufthansa.com',
  'air france': 'airfrance.com',
  'airfrance': 'airfrance.com',
  'klm': 'klm.com',
  'klm royal dutch airlines': 'klm.com',
  'ryanair': 'ryanair.com',
  'easyjet': 'easyjet.com',
  'easy jet': 'easyjet.com',
  'swiss': 'swiss.com',
  'swiss international air lines': 'swiss.com',
  'iberia': 'iberia.com',
  'tap portugal': 'flytap.com',
  'tap air portugal': 'flytap.com',
  'tap': 'flytap.com',
  'scandinavian airlines': 'flysas.com',
  'sas': 'flysas.com',
  'finnair': 'finnair.com',
  'austrian airlines': 'austrian.com',
  'austrian': 'austrian.com',
  'aer lingus': 'aerlingus.com',
  'vueling': 'vueling.com',
  'norwegian': 'norwegian.com',
  'norwegian air shuttle': 'norwegian.com',
  'eurowings': 'eurowings.com',
  'wizz air': 'wizzair.com',
  'wizzair': 'wizzair.com',
  'transavia': 'transavia.com',
  'icelandair': 'icelandair.com',
  'alitalia': 'alitalia.com',
  'ita airways': 'ita-airways.com',
  'ita': 'ita-airways.com',
  'lot polish airlines': 'lot.com',
  'lot': 'lot.com',
  'air europa': 'aireuropa.com',
  'brussels airlines': 'brusselsairlines.com',

  // Asian Airlines
  'emirates': 'emirates.com',
  'qatar airways': 'qatarairways.com',
  'qatar': 'qatarairways.com',
  'etihad airways': 'etihad.com',
  'etihad': 'etihad.com',
  'singapore airlines': 'singaporeair.com',
  'singapore': 'singaporeair.com',
  'cathay pacific': 'cathaypacific.com',
  'cathay': 'cathaypacific.com',
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
  'garuda indonesia': 'garuda-indonesia.com',
  'garuda': 'garuda-indonesia.com',
  'vietnam airlines': 'vietnamairlines.com',
  'air china': 'airchina.com',
  'china southern': 'csair.com',
  'china southern airlines': 'csair.com',
  'china eastern': 'ceair.com',
  'china eastern airlines': 'ceair.com',
  'eva air': 'evaair.com',
  'eva': 'evaair.com',
  'philippine airlines': 'philippineairlines.com',
  'cebu pacific': 'cebupacificair.com',
  'air india': 'airindia.com',
  'indigo': 'goindigo.in',

  // Middle East
  'saudia': 'saudia.com',
  'saudi arabian airlines': 'saudia.com',
  'royal jordanian': 'rj.com',
  'oman air': 'omanair.com',
  'gulf air': 'gulfair.com',
  'el al': 'elal.com',
  'el al israel airlines': 'elal.com',

  // Oceania
  'qantas': 'qantas.com',
  'air new zealand': 'airnewzealand.com',
  'virgin australia': 'virginaustralia.com',
  'jetstar': 'jetstar.com',
  'fiji airways': 'fijiairways.com',

  // Americas
  'air canada': 'aircanada.com',
  'westjet': 'westjet.com',
  'latam': 'latam.com',
  'latam airlines': 'latam.com',
  'avianca': 'avianca.com',
  'aeromexico': 'aeromexico.com',
  'copa airlines': 'copaair.com',
  'copa': 'copaair.com',
  'gol': 'voegol.com.br',
  'azul': 'voeazul.com.br',
  'azul brazilian airlines': 'voeazul.com.br',
  'volaris': 'volaris.com',
  'viva aerobus': 'vivaaerobus.com',

  // Other
  'virgin atlantic': 'virginatlantic.com',
  'turkish airlines': 'turkishairlines.com',
  'turkish': 'turkishairlines.com',
  'south african airways': 'flysaa.com',
  'kenya airways': 'kenya-airways.com',
  'ethiopian airlines': 'ethiopianairlines.com',
  'egypt air': 'egyptair.com',
  'egyptair': 'egyptair.com',
  'royal air maroc': 'royalairmaroc.com',
}

// IATA airline codes to domains
const AIRLINE_CODES: Record<string, string> = {
  // US
  'ua': 'united.com',
  'dl': 'delta.com',
  'aa': 'aa.com',
  'wn': 'southwest.com',
  'b6': 'jetblue.com',
  'as': 'alaskaair.com',
  'nk': 'spirit.com',
  'f9': 'flyfrontier.com',
  'ha': 'hawaiianairlines.com',
  'sy': 'suncountry.com',
  'g4': 'allegiantair.com',
  // Europe
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
  'dy': 'norwegian.com',
  'ew': 'eurowings.com',
  'w6': 'wizzair.com',
  'to': 'transavia.com',
  'fi': 'icelandair.com',
  'az': 'ita-airways.com',
  'lo': 'lot.com',
  'ux': 'aireuropa.com',
  'sn': 'brusselsairlines.com',
  // Middle East & Asia
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
  'ga': 'garuda-indonesia.com',
  'vn': 'vietnamairlines.com',
  'ca': 'airchina.com',
  'cz': 'csair.com',
  'mu': 'ceair.com',
  'br': 'evaair.com',
  'pr': 'philippineairlines.com',
  '5j': 'cebupacificair.com',
  'ai': 'airindia.com',
  '6e': 'goindigo.in',
  'sv': 'saudia.com',
  'rj': 'rj.com',
  'wy': 'omanair.com',
  'gf': 'gulfair.com',
  'ly': 'elal.com',
  'tk': 'turkishairlines.com',
  // Oceania
  'qf': 'qantas.com',
  'nz': 'airnewzealand.com',
  'va': 'virginaustralia.com',
  'jq': 'jetstar.com',
  'fj': 'fijiairways.com',
  // Americas
  'ac': 'aircanada.com',
  'ws': 'westjet.com',
  'la': 'latam.com',
  'av': 'avianca.com',
  'am': 'aeromexico.com',
  'cm': 'copaair.com',
  'g3': 'voegol.com.br',
  'ad': 'voeazul.com.br',
  'y4': 'volaris.com',
  // Other
  'vs': 'virginatlantic.com',
  'sa': 'flysaa.com',
  'kq': 'kenya-airways.com',
  'et': 'ethiopianairlines.com',
  'ms': 'egyptair.com',
  'at': 'royalairmaroc.com',
}

/**
 * Returns a Clearbit logo URL for an airline.
 * Accepts airline names, IATA codes, or flight numbers (extracts code).
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

  // Try IATA code (2 letters)
  if (!domain && normalized.length === 2) {
    domain = AIRLINE_CODES[normalized]
  }

  // Try extracting IATA code from flight number (e.g., "AF0274" or "DL 263")
  if (!domain) {
    const flightMatch = normalized.match(/^([a-z]{2})\s*\d/)
    if (flightMatch) {
      domain = AIRLINE_CODES[flightMatch[1]]
    }
  }

  // Try extracting IATA code from alphanumeric format (e.g., "UA1234")
  if (!domain) {
    const alphaMatch = normalized.match(/^([a-z]{2})\d+$/)
    if (alphaMatch) {
      domain = AIRLINE_CODES[alphaMatch[1]]
    }
  }

  if (!domain) {
    console.log(`No airline logo found for: "${airlineName}"`)
    return null
  }

  return `https://logo.clearbit.com/${domain}`
}

/**
 * Extracts airline code from a flight number.
 * e.g., "AF0274" -> "AF", "DL 263" -> "DL"
 */
export function extractAirlineCode(flightNumber: string): string | null {
  if (!flightNumber) return null
  const match = flightNumber.match(/^([A-Z]{2})\s*\d/i)
  return match ? match[1].toUpperCase() : null
}
