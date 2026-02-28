import { generateText, gateway } from 'ai'
import {
  TRAVEL_EXTRACTION_SYSTEM_PROMPT,
  buildExtractionPrompt,
  buildSystemPromptWithExamples,
} from './prompts'
import { selectExamples } from './example-selection'
import type { TripItemKind, TripItemStatus } from '@/types/database'

export interface ExtractedItem {
  kind: TripItemKind
  provider: string | null
  confirmation_code: string | null
  traveler_names: string[]
  start_date: string
  end_date: string | null
  start_ts: string | null
  end_ts: string | null
  start_location: string | null
  end_location: string | null
  summary: string | null
  status: TripItemStatus
  confidence: number
  needs_review: boolean
  details: Record<string, unknown>
}

export interface ExtractionResult {
  doc_type: string
  overall_confidence: number
  items: ExtractedItem[]
}

export interface ExtractTravelDataOptions {
  senderDomain?: string
}

interface DateNormalizationContext {
  referenceDate: Date
  sourceText: string
}

interface ParsedDateParts {
  year: number
  month: number
  day: number
}

const MONTH_NAME_TO_NUMBER: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
}

const MONTH_SOURCE_VARIANTS: Record<number, string[]> = {
  1: ['january', 'jan'],
  2: ['february', 'feb'],
  3: ['march', 'mar'],
  4: ['april', 'apr'],
  5: ['may'],
  6: ['june', 'jun'],
  7: ['july', 'jul'],
  8: ['august', 'aug'],
  9: ['september', 'sep', 'sept'],
  10: ['october', 'oct'],
  11: ['november', 'nov'],
  12: ['december', 'dec'],
}

export async function extractTravelData(
  subject: string,
  body: string,
  attachmentText?: string,
  options?: ExtractTravelDataOptions
): Promise<ExtractionResult> {
  // Select relevant few-shot examples based on sender domain
  const examples = await selectExamples(options?.senderDomain)

  if (examples.length > 0) {
    console.log(`Using ${examples.length} extraction examples for ${options?.senderDomain || 'unknown domain'}`)
  }

  // Build enhanced prompt with examples
  const systemPrompt = buildSystemPromptWithExamples(
    TRAVEL_EXTRACTION_SYSTEM_PROMPT,
    examples
  )

  const prompt = buildExtractionPrompt(subject, body, attachmentText)

  const { text } = await generateText({
    model: gateway('anthropic/claude-sonnet-4'),
    system: systemPrompt,
    prompt,
  })

  // Parse JSON from response
  try {
    // Try to extract JSON from the response (in case there's extra text)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const result = JSON.parse(jsonMatch[0]) as ExtractionResult

    // Validate and normalize the result
    const context: DateNormalizationContext = {
      referenceDate: startOfUtcDay(new Date()),
      sourceText: [subject, body, attachmentText || ''].filter(Boolean).join('\n'),
    }

    return normalizeExtractionResult(result, context)
  } catch (error) {
    console.error('Failed to parse AI response:', error)
    console.error('Raw response:', text)

    return {
      doc_type: 'unknown',
      overall_confidence: 0,
      items: [],
    }
  }
}

function normalizeExtractionResult(
  result: ExtractionResult,
  context: DateNormalizationContext
): ExtractionResult {
  const validKinds: TripItemKind[] = [
    'flight',
    'hotel',
    'train',
    'car',
    'restaurant',
    'activity',
    'other',
  ]

  const validStatuses: TripItemStatus[] = [
    'confirmed',
    'cancelled',
    'changed',
    'pending',
    'unknown',
  ]

  const items = (result.items || []).map((item) => {
    // Ensure kind is valid
    const kind = validKinds.includes(item.kind) ? item.kind : 'other'

    // Ensure status is valid
    const status = validStatuses.includes(item.status) ? item.status : 'unknown'

    // Ensure confidence is a valid number
    const confidence =
      typeof item.confidence === 'number' && item.confidence >= 0 && item.confidence <= 1
        ? item.confidence
        : 0.5

    // Set needs_review if confidence is low
    const needs_review = item.needs_review || confidence < 0.65

    // Ensure dates are in correct format
    const start_date = normalizeDate(item.start_date, context)
    const end_date = item.end_date ? normalizeDate(item.end_date, context) : null

    return {
      ...item,
      kind,
      status,
      confidence,
      needs_review,
      start_date: start_date || formatIsoDate(context.referenceDate),
      end_date,
      traveler_names: Array.isArray(item.traveler_names) ? item.traveler_names : [],
      details: item.details || {},
    }
  })

  return {
    ...result,
    doc_type: result.doc_type || 'unknown',
    overall_confidence:
      typeof result.overall_confidence === 'number'
        ? result.overall_confidence
        : items.length > 0
        ? items.reduce((sum, i) => sum + i.confidence, 0) / items.length
        : 0,
    items,
  }
}

function normalizeDate(
  dateStr: string | null | undefined,
  context: DateNormalizationContext
): string | null {
  if (!dateStr) return null

  const parsed = parseDateParts(dateStr, context.referenceDate.getUTCFullYear())
  if (!parsed) return null

  const extractedDate = createUtcDate(parsed.year, parsed.month, parsed.day)
  if (!extractedDate) return null

  // Preserve explicit years from the source email; otherwise move month/day to next future occurrence.
  if (isYearExplicitForDate(context.sourceText, parsed)) {
    return formatIsoDate(extractedDate)
  }

  const nextOccurrence = getNextOccurrence(parsed.month, parsed.day, context.referenceDate)
  if (!nextOccurrence) {
    return null
  }

  return formatIsoDate(nextOccurrence)
}

function parseDateParts(dateStr: string, fallbackYear: number): ParsedDateParts | null {
  const raw = dateStr.trim()
  if (!raw) return null

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) {
    return {
      year: Number(iso[1]),
      month: Number(iso[2]),
      day: Number(iso[3]),
    }
  }

  const slashIso = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
  if (slashIso) {
    return {
      year: Number(slashIso[1]),
      month: Number(slashIso[2]),
      day: Number(slashIso[3]),
    }
  }

  const monthDayPattern = /^([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{2,4}))?$/i
  const monthDay = raw.match(monthDayPattern)
  if (monthDay) {
    const month = MONTH_NAME_TO_NUMBER[monthDay[1].toLowerCase()]
    if (!month) return null
    const day = Number(monthDay[2])
    const year = parseYearToken(monthDay[3], fallbackYear)
    return { year, month, day }
  }

  const dayMonthPattern = /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\.?(?:,?\s+(\d{2,4}))?$/i
  const dayMonth = raw.match(dayMonthPattern)
  if (dayMonth) {
    const month = MONTH_NAME_TO_NUMBER[dayMonth[2].toLowerCase()]
    if (!month) return null
    const day = Number(dayMonth[1])
    const year = parseYearToken(dayMonth[3], fallbackYear)
    return { year, month, day }
  }

  const numeric = raw.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?$/)
  if (numeric) {
    const first = Number(numeric[1])
    const second = Number(numeric[2])
    const month = first > 12 ? second : first
    const day = first > 12 ? first : second
    const year = parseYearToken(numeric[3], fallbackYear)
    return { year, month, day }
  }

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null

  return {
    year: parsed.getUTCFullYear(),
    month: parsed.getUTCMonth() + 1,
    day: parsed.getUTCDate(),
  }
}

function parseYearToken(token: string | undefined, fallbackYear: number): number {
  if (!token) return fallbackYear

  const year = Number(token)
  if (!Number.isFinite(year)) return fallbackYear

  if (token.length === 2) {
    return year >= 70 ? 1900 + year : 2000 + year
  }

  return year
}

function createUtcDate(year: number, month: number, day: number): Date | null {
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return date
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function formatIsoDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getNextOccurrence(month: number, day: number, referenceDate: Date): Date | null {
  let year = referenceDate.getUTCFullYear()

  // Loop allows handling dates like Feb 29 when the current year is not a leap year.
  for (let i = 0; i < 8; i += 1) {
    const candidate = createUtcDate(year, month, day)
    if (candidate && candidate.getTime() >= referenceDate.getTime()) {
      return candidate
    }
    year += 1
  }

  return null
}

function isYearExplicitForDate(sourceText: string, date: ParsedDateParts): boolean {
  if (!sourceText.trim()) return false

  const { year, month, day } = date
  const shortYear = String(year).slice(-2)
  const yearPattern = `(?:${year}|'?${shortYear})`
  const monthPattern = `0?${month}`
  const dayPattern = `0?${day}`
  const separatorPattern = '[./-]'

  const numericPatterns = [
    new RegExp(`\\b${monthPattern}${separatorPattern}${dayPattern}${separatorPattern}${yearPattern}\\b`, 'i'),
    new RegExp(`\\b${dayPattern}${separatorPattern}${monthPattern}${separatorPattern}${yearPattern}\\b`, 'i'),
    new RegExp(`\\b${year}${separatorPattern}${monthPattern}${separatorPattern}${dayPattern}\\b`, 'i'),
  ]

  for (const pattern of numericPatterns) {
    if (pattern.test(sourceText)) return true
  }

  const monthVariants = MONTH_SOURCE_VARIANTS[month] || []
  for (const variant of monthVariants) {
    const escapedMonth = escapeRegex(variant)
    const monthFirst = new RegExp(
      `\\b${escapedMonth}\\.?\\s+${dayPattern}(?:st|nd|rd|th)?(?:,)?\\s+${yearPattern}\\b`,
      'i'
    )
    const dayFirst = new RegExp(
      `\\b${dayPattern}(?:st|nd|rd|th)?\\s+${escapedMonth}\\.?(?:,)?\\s+${yearPattern}\\b`,
      'i'
    )
    if (monthFirst.test(sourceText) || dayFirst.test(sourceText)) {
      return true
    }
  }

  return false
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
