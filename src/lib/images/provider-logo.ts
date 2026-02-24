/**
 * Universal provider logo system.
 * 
 * - Airlines: pics.avs.io (IATA code based, high quality)
 * - Everything else: Google Favicon service via provider domain map
 * 
 * Google Favicons: https://www.google.com/s2/favicons?domain={domain}&sz=128
 * Free, no API key, reliable, 128px max.
 */

import { getAirlineLogoUrl } from './airline-logo'

// Map provider names to their primary domain (for favicon lookup)
const PROVIDER_DOMAINS: Record<string, string> = {
  // Train operators
  'sncf': 'sncf.com',
  'sncf voyageurs': 'sncf.com',
  'tgv': 'sncf.com',
  'tgv inouï': 'sncf.com',
  'ouigo': 'ouigo.com',
  'trenitalia': 'trenitalia.com',
  'italo': 'italotreno.it',
  'deutsche bahn': 'bahn.de',
  'db': 'bahn.de',
  'eurostar': 'eurostar.com',
  'thalys': 'thalys.com',
  'renfe': 'renfe.com',
  'amtrak': 'amtrak.com',
  'via rail': 'viarail.ca',
  'swiss federal railways': 'sbb.ch',
  'sbb': 'sbb.ch',
  'öbb': 'oebb.at',
  'ns': 'ns.nl',
  'nsb': 'vy.no',
  'vy': 'vy.no',
  'iryo': 'iryo.eu',
  'flixbus': 'flixbus.com',
  'flixtrain': 'flixtrain.com',

  // Car rental
  'sixt': 'sixt.com',
  'hertz': 'hertz.com',
  'avis': 'avis.com',
  'europcar': 'europcar.com',
  'enterprise': 'enterprise.com',
  'budget': 'budget.com',
  'national': 'nationalcar.com',
  'alamo': 'alamo.com',
  'thrifty': 'thrifty.com',
  'dollar': 'dollar.com',
  'getaround': 'getaround.com',
  'turo': 'turo.com',

  // Hotels & Accommodation
  'marriott': 'marriott.com',
  'hilton': 'hilton.com',
  'hyatt': 'hyatt.com',
  'ihg': 'ihg.com',
  'accor': 'accor.com',
  'novotel': 'accor.com',
  'ibis': 'accor.com',
  'sofitel': 'accor.com',
  'mercure': 'accor.com',
  'pullman': 'accor.com',
  'four seasons': 'fourseasons.com',
  'ritz-carlton': 'ritzcarlton.com',
  'the ritz-carlton': 'ritzcarlton.com',
  'w hotels': 'marriott.com',
  'sheraton': 'marriott.com',
  'westin': 'marriott.com',
  'best western': 'bestwestern.com',
  'radisson': 'radissonhotels.com',
  'intercontinental': 'ihg.com',
  'holiday inn': 'ihg.com',
  'crowne plaza': 'ihg.com',
  'airbnb': 'airbnb.com',
  'booking.com': 'booking.com',
  'vrbo': 'vrbo.com',
  'mitsui garden hotels': 'gardenhotels.co.jp',

  // Ferries & Cruise
  'corsica ferries': 'corsica-ferries.fr',
  'dfds': 'dfds.com',
  'stena line': 'stenaline.com',
  'viking line': 'vikingline.com',
  'tallink': 'tallink.com',
  'brittany ferries': 'brittany-ferries.co.uk',
  'p&o ferries': 'poferries.com',
  'msc cruises': 'msccruises.com',

  // Activities & Other
  'uber': 'uber.com',
  'lyft': 'lyft.com',
  'bolt': 'bolt.eu',
  'freenow': 'free-now.com',
  'blablacar': 'blablacar.com',
}

/**
 * Get provider logo URL. Tries airline logo first (high quality),
 * falls back to Google Favicon service for all other providers.
 */
export function getProviderLogoUrl(
  provider: string,
  kind?: string
): string | null {
  if (!provider) return null

  // For flights, try the airline logo system first (higher quality)
  if (kind === 'flight') {
    const airlineLogo = getAirlineLogoUrl(provider)
    if (airlineLogo) return airlineLogo
  }

  // Look up domain for Google Favicon
  const normalized = provider.trim().toLowerCase()
  const domain = PROVIDER_DOMAINS[normalized]

  if (domain) {
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
  }

  // Last resort: try the airline system even for non-flights
  // (covers cases like "Air France HOP" on a train codeshare)
  const airlineFallback = getAirlineLogoUrl(provider)
  if (airlineFallback) return airlineFallback

  return null
}

/**
 * Check if a provider has a known logo.
 */
export function hasProviderLogo(provider: string, kind?: string): boolean {
  return getProviderLogoUrl(provider, kind) !== null
}
