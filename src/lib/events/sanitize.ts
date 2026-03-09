import type { EventCategory } from '@/types/events'

export interface SanitizedFeedback {
  sanitizedText: string
  extractedUrls: string[]
  extractedEvent: {
    detectedCategory: EventCategory
    suggestedTitle: string | null
  }
}

const URL_RE = /\bhttps?:\/\/[^\s<>"')]+/gi

export function stripHtmlToText(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

export function extractUrls(input: string): string[] {
  const matches = input.match(URL_RE) ?? []
  return Array.from(new Set(matches.map((url) => url.replace(/[),.;!?]+$/, ''))))
}

export function classifyFeedback(text: string): EventCategory {
  const normalized = text.toLowerCase()
  if (/\b(museum|gallery|exhibition|biennale|retrospective)\b/.test(normalized)) return 'art'
  if (/\b(concert|gig|dj|orchestra|jazz|opera|music)\b/.test(normalized)) return 'music'
  if (/\b(play|theater|theatre|ballet|dance|performance)\b/.test(normalized)) return 'theater'
  if (/\b(food|restaurant|market|tasting|wine)\b/.test(normalized)) return 'food'
  if (/\b(festival|fair|carnival|parade)\b/.test(normalized)) return 'festival'
  if (/\b(match|game|race|tournament|stadium|sports?)\b/.test(normalized)) return 'sports'
  if (/\b(church|cathedral|abbey|temple|mosque|synagogue|sacred)\b/.test(normalized)) return 'sacred'
  if (/\b(market|bazaar)\b/.test(normalized)) return 'market'
  return 'other'
}

export function inferSuggestedTitle(text: string): string | null {
  const cleaned = text.trim()
  if (!cleaned) return null
  const firstSentence = cleaned.split(/[.!?]\s/)[0]?.trim() ?? ''
  if (!firstSentence) return null
  return firstSentence.slice(0, 120)
}

export function sanitizeEventFeedback(rawText: string): SanitizedFeedback {
  const sanitizedText = stripHtmlToText(rawText)
  return {
    sanitizedText,
    extractedUrls: extractUrls(rawText),
    extractedEvent: {
      detectedCategory: classifyFeedback(sanitizedText),
      suggestedTitle: inferSuggestedTitle(sanitizedText),
    },
  }
}
