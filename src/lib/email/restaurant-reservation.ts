import { stripHtmlToText } from '@/lib/events/sanitize'
import type { ExtractedItem } from '@/lib/ai/extract-travel-data'

const RESERVATION_KEYWORDS = [
  'reservation accepted',
  'reservation confirmed',
  'booked your reservation',
  'your reservation',
  'table for',
  'party of',
  'reservation #',
  'confirmation #',
  'confirm your reservation',
]

const RESTAURANT_CUES = [
  'restaurant',
  'dining',
  'dinner',
  'lunch',
  'brunch',
  'sushi',
  'bistro',
  'cafe',
  'café',
  'steakhouse',
  'grill',
  'kitchen',
  'izakaya',
  'ramen',
  'trattoria',
  'tavern',
  'pizzeria',
  'omakase',
  'yakitori',
  'wine bar',
  'bar',
]

function toLines(input: string): string[] {
  return input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function normalizeText(input: string): string {
  return stripHtmlToText(input).toLowerCase()
}

function parseDate(text: string): string | null {
  const match = text.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/)
  if (!match) return null
  const parsed = new Date(`${match[1]} ${match[2]}, ${match[3]}`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

function parseTime(text: string): string | null {
  const match = text.match(/\b(\d{1,2}:\d{2}(?:\s*[AP]M)?)\b/i)
  if (!match) return null
  const raw = match[1].replace(/\s+/g, ' ').trim().toUpperCase()
  const timeMatch = raw.match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/)
  if (!timeMatch) return raw

  let hours = Number.parseInt(timeMatch[1], 10)
  const minutes = timeMatch[2]
  const meridiem = timeMatch[3]

  if (meridiem === 'PM' && hours < 12) hours += 12
  if (meridiem === 'AM' && hours === 12) hours = 0

  return `${String(hours).padStart(2, '0')}:${minutes}`
}

function parsePartySize(text: string): number | null {
  const match = text.match(/\b(\d+)\s+(?:people|guests?|covers?)\b/i)
  if (!match) return null
  const size = Number.parseInt(match[1], 10)
  return Number.isFinite(size) ? size : null
}

function parseConfirmationCode(text: string): string | null {
  const lineMatch = toLines(text).find((line) => /\b(?:confirmation|reservation)\b/i.test(line) && /(?:#|no\.?|number)/i.test(line))
  const match = lineMatch?.match(/\b(?:confirmation|reservation)\s*(?:#|no\.?|number)\s*[:\-]?\s*([A-Z0-9-]{4,})\b/i)
  return match?.[1]?.trim() ?? null
}

function parseSeating(text: string): string | null {
  const match = text.match(/\b(counter|table|booth|bar|patio|terrace|private room)\b/i)
  return match?.[1] ?? null
}

function parsePurpose(text: string): string | null {
  const match = text.match(/\bpurpose\s*[:\-]?\s*([^\n]+)/i)
  return match?.[1]?.trim() ?? null
}

function looksLikeAddressLine(line: string): boolean {
  if (/^\d+\s+(people|guests?|covers?)$/i.test(line)) return false
  if (/^\bparty of\b/i.test(line)) return false
  return (
    /,\s*[A-Za-z]{2,}\b/.test(line) ||
    /\b\d{5}(?:-\d{4})?\b/.test(line) ||
    /\d+\s+[A-Za-z].*(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Lane|Ln\.?|Drive|Dr\.?|Way|Place|Pl\.?)/i.test(line)
  )
}

function isMetadataLine(line: string): boolean {
  return /^(reservation accepted|we'?ve successfully booked your reservation|reservation confirmed|confirmation #|confirmation number|reservation #|call|view|cancel|purpose|category|party of|table for|people?|guests?|covers?|date|time|name|restaurant)$/i.test(line)
    || /^\d{1,2}:\d{2}(?:\s*[AP]M)?$/i.test(line)
    || /^\w{3,9}\s+\d{1,2},?\s+\d{4}/i.test(line)
}

function scoreNameCandidate(line: string): number {
  const lower = line.toLowerCase()
  if (isMetadataLine(line)) return -100
  if (/@|https?:\/\//i.test(line)) return -100
  if (line.length < 2 || line.length > 80) return -100

  let score = 0
  if (/^[A-Z][\p{L}'’&().,-]+(?:\s+[A-Z0-9][\p{L}'’&().,-]+){0,5}$/u.test(line)) score += 4
  if (/[A-Za-z]/.test(line) && line.split(' ').length <= 5) score += 1
  if (RESTAURANT_CUES.some((cue) => lower.includes(cue))) score += 4
  if (/\b(?:sushi|restaurant|bistro|cafe|steakhouse|grill|kitchen|bar|omakase|ramen|trattoria|tavern)\b/i.test(line)) score += 3
  if (/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(line) && !RESTAURANT_CUES.some((cue) => lower.includes(cue))) score -= 1
  return score
}

function parseRestaurantName(lines: string[], text: string): string | null {
  const headerIndex = lines.findIndex((line) => /reservation|booked your reservation|reservation accepted|reservation confirmed/i.test(line))
  const searchStart = headerIndex >= 0 ? headerIndex + 1 : 0
  let best: { line: string; score: number } | null = null

  for (let i = searchStart; i < lines.length; i += 1) {
    const line = lines[i]
    const score = scoreNameCandidate(line)
    if (score <= 0) continue
    if (!best || score > best.score) {
      best = { line, score }
    }
    if (best && best.score >= 6) break
  }

  if (best) return best.line

  const fallback = lines.find((line) => {
    const score = scoreNameCandidate(line)
    return score > 0 && !isMetadataLine(line)
  })
  if (fallback) return fallback

  const subjectMatch = text.match(/\b(?:reservation|booking)\s+([A-Z][A-Za-z0-9'&().,-]*(?:\s+[A-Z][A-Za-z0-9'&().,-]*){0,4})/i)
  return subjectMatch?.[1]?.trim() ?? null
}

export function looksLikeRestaurantReservationEmail(subject: string, bodyText: string): boolean {
  const text = normalizeText(`${subject}\n${bodyText}`)
  const hasReservationSignal = RESERVATION_KEYWORDS.some((keyword) => text.includes(keyword))
  const hasRestaurantSignal = RESTAURANT_CUES.some((cue) => text.includes(cue))
    || /\b\d+\s+(?:people|guests?|covers?)\b/i.test(text)
    || /\b\d{1,2}:\d{2}(?:\s*[ap]m)?\b/i.test(text)

  return hasReservationSignal && hasRestaurantSignal
}

export function parseRestaurantReservationEmail(subject: string, bodyText: string): ExtractedItem | null {
  if (!looksLikeRestaurantReservationEmail(subject, bodyText)) return null

  const text = stripHtmlToText(`${subject}\n${bodyText}`)
  const lines = toLines(`${subject}\n${bodyText}`)
  const restaurantName = parseRestaurantName(lines, text)
  const date = parseDate(text)
  const time = parseTime(text)
  const partySize = parsePartySize(text)
  const confirmationCode = parseConfirmationCode(text)
  const seating = parseSeating(text)
  const purpose = parsePurpose(text)

  if (!restaurantName || !date) return null

  const addressLine = lines.find((line) => looksLikeAddressLine(line)) ?? null

  const confidence =
    0.95 -
    (time ? 0 : 0.08) -
    (partySize ? 0 : 0.05) -
    (confirmationCode ? 0 : 0.05) -
    (addressLine ? 0 : 0.05)

  return {
    kind: 'restaurant',
    provider: restaurantName,
    confirmation_code: confirmationCode,
    traveler_names: [],
    start_date: date,
    end_date: null,
    start_ts: null,
    end_ts: null,
    start_location: addressLine,
    end_location: null,
    summary: `Reservation at ${restaurantName}${partySize ? ` for ${partySize}` : ''}${time ? ` at ${time}` : ''}`.trim(),
    status: 'confirmed',
    confidence: Math.max(0.7, Math.min(0.98, confidence)),
    needs_review: !time || !partySize || !confirmationCode || !addressLine,
    details: {
      restaurant_name: restaurantName,
      address: addressLine,
      reservation_time: time,
      party_size: partySize,
      seating,
      purpose,
      contact_phone: null,
      booking_reference: confirmationCode,
    },
  }
}
