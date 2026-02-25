const NORMALIZE_RE = /[^a-z0-9]+/g
const STOP_WORDS = new Set([
  'airlines',
  'airline',
  'airways',
  'airway',
  'air',
  'hotel',
  'hotels',
  'rewards',
  'club',
  'program',
  'plus',
  'miles',
  'honors',
])

export function normalizeProviderKey(rawName: string): string {
  const words = rawName
    .toLowerCase()
    .trim()
    .split(/[\s\-_.,/&+()]+/)
    .filter((word) => word && !STOP_WORDS.has(word))

  const candidate = words.join('')
  return candidate.replace(NORMALIZE_RE, '')
}

export const PROVIDER_KEY_ALIASES: Record<string, string> = {
  'united airlines': 'united',
  unitedairlines: 'united',
  ua: 'united',
  'delta air lines': 'delta',
  deltaairlines: 'delta',
  dl: 'delta',
  'american airlines': 'aa',
  americanairlines: 'aa',
  aa: 'aa',
  'british airways': 'ba',
  britishairways: 'ba',
  ba: 'ba',
  'air canada': 'aircanada',
  aircanada: 'aircanada',
  ac: 'aircanada',
  lufthansaairlines: 'lufthansa',
  lh: 'lufthansa',
  swissair: 'swiss',
  lx: 'swiss',
  klmroyaldutch: 'klm',
  afklm: 'airfrance',
  'air france': 'airfrance',
  airfrance: 'airfrance',
  af: 'airfrance',
  aeromexico: 'aeromexico',
  am: 'aeromexico',
  anajapan: 'ana',
  ana: 'ana',
  turkishairlines: 'turkish',
  tapairportugal: 'tap',
  jetblue: 'jetblue',
  emirates: 'emirates',
  etihad: 'etihad',
  qantasairways: 'qantas',
  finnairplus: 'finnair',
  marriottbonvoy: 'marriott',
  marriott: 'marriott',
  hiltonhonors: 'hilton',
  hilton: 'hilton',
  ihgone: 'ihg',
  ihg: 'ihg',
  worldofhyatt: 'hyatt',
  hyatt: 'hyatt',
  accorlive: 'accor',
  accor: 'accor',
  wyndhamrewards: 'wyndham',
  wyndham: 'wyndham',
  hertzgold: 'hertz',
  hertz: 'hertz',
  avispreferred: 'avis',
  avis: 'avis',
  budgetfastbreak: 'budget',
  budget: 'budget',
  enterpriseplus: 'enterprise',
  enterpriserentacar: 'enterprise',
  alamoinsiders: 'alamo',
  alamorentacar: 'alamo',
  nationalemeraldclub: 'national',
  nationalcar: 'national',
  sixtcard: 'sixt',
  sixt: 'sixt',
}

export function resolveProviderKey(rawName: string): string {
  const trimmed = rawName.trim()
  if (!trimmed) return ''

  const normalized = normalizeProviderKey(trimmed)
  const normalizedAlias = PROVIDER_KEY_ALIASES[normalized]
  if (normalizedAlias) return normalizedAlias

  const aliasDirect = PROVIDER_KEY_ALIASES[trimmed.toLowerCase()]
  if (aliasDirect) return aliasDirect

  const compressed = trimmed.toLowerCase().replace(NORMALIZE_RE, '')
  return PROVIDER_KEY_ALIASES[compressed] ?? (normalized || compressed)
}
