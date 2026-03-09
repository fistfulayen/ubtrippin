import type { DiscoveredEventCandidate, ExistingEventRecord } from './types'

export interface DuplicateMatch<TExisting> {
  existing: TExisting
  similarity: number
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|a|an|live|official|tour|show|event|in concert|en concert|concert|exhibition|exposition)\b/g, ' ')
    .replace(/\s*\|.*$/, '')  // strip source suffixes like "| Music Festival Wizard"
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(left: string, right: string): number {
  if (left === right) return 0
  if (!left.length) return right.length
  if (!right.length) return left.length

  const rows = Array.from({ length: left.length + 1 }, () => new Array<number>(right.length + 1).fill(0))

  for (let i = 0; i <= left.length; i += 1) rows[i][0] = i
  for (let j = 0; j <= right.length; j += 1) rows[0][j] = j

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + cost
      )
    }
  }

  return rows[left.length][right.length]
}

function tokenOverlap(left: string, right: string): number {
  const leftTokens = new Set(left.split(' ').filter(Boolean))
  const rightTokens = new Set(right.split(' ').filter(Boolean))
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0

  let overlap = 0
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1
  }

  return overlap / Math.max(leftTokens.size, rightTokens.size)
}

export function titleSimilarity(left: string, right: string): number {
  const normalizedLeft = normalizeText(left)
  const normalizedRight = normalizeText(right)
  if (!normalizedLeft || !normalizedRight) return 0
  if (normalizedLeft === normalizedRight) return 1

  const lev = levenshtein(normalizedLeft, normalizedRight)
  const levScore = 1 - lev / Math.max(normalizedLeft.length, normalizedRight.length)
  const overlapScore = tokenOverlap(normalizedLeft, normalizedRight)
  return Number((((levScore * 0.65) + (overlapScore * 0.35)) * 100).toFixed(2)) / 100
}

export function datesOverlap(
  leftStart: string,
  leftEnd: string | null | undefined,
  rightStart: string,
  rightEnd: string | null | undefined
): boolean {
  const leftFinal = leftEnd ?? leftStart
  const rightFinal = rightEnd ?? rightStart
  return !(leftFinal < rightStart || rightFinal < leftStart)
}

function sameVenue(left: string | null | undefined, right: string | null | undefined): boolean {
  const normalizedLeft = normalizeText(left)
  const normalizedRight = normalizeText(right)
  if (!normalizedLeft || !normalizedRight) return true
  return normalizedLeft === normalizedRight
}

function informationScore(event: Pick<
  DiscoveredEventCandidate | ExistingEventRecord,
  'description' | 'image_url' | 'booking_url' | 'time_info'
>): number {
  let score = 0
  if (event.description) score += Math.min(event.description.length, 500)
  if (event.image_url) score += 120
  if (event.booking_url) score += 120
  if (event.time_info) score += 40
  return score
}

export function findDuplicate<TExisting extends Pick<
  ExistingEventRecord,
  'title' | 'venue_name' | 'start_date' | 'end_date'
>>(
  candidate: Pick<DiscoveredEventCandidate, 'title' | 'venue_name' | 'start_date' | 'end_date'>,
  existingEvents: TExisting[]
): DuplicateMatch<TExisting> | null {
  let best: DuplicateMatch<TExisting> | null = null

  for (const existing of existingEvents) {
    const similarity = titleSimilarity(candidate.title, existing.title)
    const venueMatch = sameVenue(candidate.venue_name, existing.venue_name)
    const dateMatch = datesOverlap(candidate.start_date, candidate.end_date, existing.start_date, existing.end_date)

    if (!dateMatch) continue

    // Standard dedup: title similarity ≥ 0.8 (regardless of venue)
    if (similarity >= 0.8 && venueMatch) {
      if (!best || similarity > best.similarity) {
        best = { existing, similarity }
      }
      continue
    }

    // Venue-anchored dedup: same venue + same date + lower title threshold (0.4)
    // Catches FR/EN translations like "Renoir et l'amour" / "Renoir and Love"
    // and variant titles like "Nan Goldin : This Will Not End Well" / "This Will Not End Well"
    if (venueMatch && similarity >= 0.4 && candidate.venue_name && existing.venue_name) {
      if (!best || similarity > best.similarity) {
        best = { existing, similarity }
      }
    }
  }

  return best
}

export function choosePreferredEvent<TExisting extends ExistingEventRecord>(
  candidate: DiscoveredEventCandidate,
  existing: TExisting
): 'candidate' | 'existing' {
  return informationScore(candidate) > informationScore(existing) ? 'candidate' : 'existing'
}

export function dedupeCandidates(candidates: DiscoveredEventCandidate[]): {
  unique: DiscoveredEventCandidate[]
  duplicates: Array<{ kept: DiscoveredEventCandidate; skipped: DiscoveredEventCandidate }>
} {
  const unique: DiscoveredEventCandidate[] = []
  const duplicates: Array<{ kept: DiscoveredEventCandidate; skipped: DiscoveredEventCandidate }> = []

  for (const candidate of candidates) {
    const match = findDuplicate(candidate, unique)
    if (!match) {
      unique.push(candidate)
      continue
    }

    const keepCandidate = informationScore(candidate) > informationScore(match.existing)
    if (keepCandidate) {
      const index = unique.findIndex((event) => event === match.existing)
      if (index >= 0) unique[index] = candidate
      duplicates.push({ kept: candidate, skipped: match.existing })
    } else {
      duplicates.push({ kept: match.existing, skipped: candidate })
    }
  }

  return { unique, duplicates }
}
