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

/**
 * Returns a Clearbit logo URL for an airline.
 * Returns null if the airline is not recognized.
 */
export function getAirlineLogoUrl(airlineName: string): string | null {
  if (!airlineName) return null

  const normalizedName = airlineName.toLowerCase().trim()
  const domain = AIRLINE_DOMAINS[normalizedName]

  if (!domain) return null

  return `https://logo.clearbit.com/${domain}`
}
