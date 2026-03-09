/**
 * Crate music scoring — research artists via Last.fm, MusicBrainz, and Tavily
 * to produce significance scores based on real critical coverage.
 */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export interface CrateScore {
  crateScore: number
  criticalCoverage: number
  listenerCount: number
  discographyDepth: number
  sources: string[]
}

const EMPTY_SCORE: CrateScore = {
  crateScore: 0,
  criticalCoverage: 0,
  listenerCount: 0,
  discographyDepth: 0,
  sources: [],
}

/**
 * Extract a likely artist name from an event title.
 * Strips common suffixes like "live at Venue", "@ Venue", "at The Venue", dates, etc.
 */
export function extractArtistName(
  title: string,
  lineup?: Array<string | { name: string; url?: string }>
): string | null {
  // If lineup has entries, use the first one
  if (lineup && lineup.length > 0) {
    const first = lineup[0]
    return (typeof first === 'string' ? first : first.name).trim()
  }

  // Try to extract artist from title
  let artist = title
    .replace(/\s*[-–—]\s*(live|concert|show|tour|performance)\b.*/i, '')
    .replace(/\s*(@|at|au|à|en)\s+.*/i, '')
    .replace(/\s*\|.*/i, '')
    .replace(/\s*[-–—]\s*\d{4}.*$/i, '')
    .replace(/\s*(festival|fest)\b.*/i, '')
    .replace(/\s*\(.*?\)/g, '')
    .trim()

  // If what remains is too short or too long, probably not an artist name
  if (artist.length < 2 || artist.length > 80) return null
  // If it still contains "events", "concerts", "guide", it's an article not an artist
  if (/\b(events?|concerts?|guide|best|must-see|top \d|what's on)\b/i.test(artist)) return null

  return artist
}

async function fetchLastFmArtist(
  artistName: string,
  apiKey: string
): Promise<{ listeners: number; playcount: number }> {
  try {
    const url = new URL('https://ws.audioscrobbler.com/2.0/')
    url.searchParams.set('method', 'artist.getinfo')
    url.searchParams.set('artist', artistName)
    url.searchParams.set('api_key', apiKey)
    url.searchParams.set('format', 'json')

    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': 'UBTrippin/1.0 (https://www.ubtrippin.xyz)' },
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) return { listeners: 0, playcount: 0 }

    const data = (await response.json()) as {
      artist?: { stats?: { listeners?: string; playcount?: string } }
    }
    return {
      listeners: parseInt(data.artist?.stats?.listeners ?? '0', 10),
      playcount: parseInt(data.artist?.stats?.playcount ?? '0', 10),
    }
  } catch {
    return { listeners: 0, playcount: 0 }
  }
}

let lastMbFetch = 0

async function fetchMusicBrainzDiscography(artistName: string): Promise<number> {
  try {
    // Rate limit: 1 req/sec for MusicBrainz
    const now = Date.now()
    if (now - lastMbFetch < 1100) await sleep(1100 - (now - lastMbFetch))
    lastMbFetch = Date.now()

    const searchUrl = `https://musicbrainz.org/ws/2/artist/?query=artist:${encodeURIComponent(artistName)}&fmt=json&limit=1`
    const searchRes = await fetch(searchUrl, {
      headers: { 'User-Agent': 'UBTrippin/1.0 (https://www.ubtrippin.xyz; hello@ubtrippin.xyz)' },
      signal: AbortSignal.timeout(8000),
    })

    if (!searchRes.ok) return 0

    const searchData = (await searchRes.json()) as {
      artists?: Array<{ id?: string; score?: number }>
    }
    const mbid = searchData.artists?.[0]?.id
    if (!mbid || (searchData.artists?.[0]?.score ?? 0) < 80) return 0

    // Wait for rate limit
    await sleep(1100)
    lastMbFetch = Date.now()

    const rgUrl = `https://musicbrainz.org/ws/2/release-group?artist=${mbid}&type=album&fmt=json&limit=100`
    const rgRes = await fetch(rgUrl, {
      headers: { 'User-Agent': 'UBTrippin/1.0 (https://www.ubtrippin.xyz; hello@ubtrippin.xyz)' },
      signal: AbortSignal.timeout(8000),
    })

    if (!rgRes.ok) return 0

    const rgData = (await rgRes.json()) as { 'release-group-count'?: number }
    return rgData['release-group-count'] ?? 0
  } catch {
    return 0
  }
}

async function fetchTavilyCoverage(
  artistName: string,
  apiKey: string
): Promise<{ count: number; publications: string[] }> {
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: `${artistName} review`,
        search_depth: 'basic',
        include_domains: [
          'pitchfork.com',
          'residentadvisor.net',
          'thewire.co.uk',
          'stereogum.com',
          'theguardian.com',
          'npr.org',
          'nme.com',
          'bandcamp.com',
          'tinymixtapes.com',
          'thelineofbestfit.com',
        ],
        max_results: 5,
      }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) return { count: 0, publications: [] }

    const data = (await response.json()) as {
      results?: Array<{ url?: string; title?: string }>
    }

    const results = data.results ?? []
    const publications = results
      .map((r) => {
        try {
          return new URL(r.url ?? '').hostname.replace('www.', '')
        } catch {
          return null
        }
      })
      .filter((h): h is string => h !== null)

    return { count: results.length, publications: [...new Set(publications)] }
  } catch {
    return { count: 0, publications: [] }
  }
}

export async function scoreArtistWithCrate(args: {
  artistName: string
  city: string
}): Promise<CrateScore> {
  const lastfmKey = process.env.LASTFM_API_KEY
  const tavilyKey = process.env.TAVILY_API_KEY

  if (!lastfmKey && !tavilyKey) return EMPTY_SCORE

  try {
    // Run Last.fm and Tavily in parallel (MusicBrainz sequential due to rate limits)
    const [lastfm, tavily] = await Promise.all([
      lastfmKey ? fetchLastFmArtist(args.artistName, lastfmKey) : Promise.resolve({ listeners: 0, playcount: 0 }),
      tavilyKey ? fetchTavilyCoverage(args.artistName, tavilyKey) : Promise.resolve({ count: 0, publications: [] }),
    ])

    const discography = await fetchMusicBrainzDiscography(args.artistName)

    const listenerScore = lastfm.listeners > 0 ? clamp(Math.log10(lastfm.listeners) * 12, 0, 40) : 0
    const coverageScore = clamp(tavily.count * 12, 0, 36)
    const discogScore = clamp(discography * 3, 0, 24)
    const crateScore = Math.round(listenerScore + coverageScore + discogScore)

    return {
      crateScore: clamp(crateScore, 0, 100),
      criticalCoverage: tavily.count,
      listenerCount: lastfm.listeners,
      discographyDepth: discography,
      sources: tavily.publications,
    }
  } catch {
    return EMPTY_SCORE
  }
}
