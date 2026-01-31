import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import {
  TRAVEL_EXTRACTION_SYSTEM_PROMPT,
  buildExtractionPrompt,
} from './prompts'
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

export async function extractTravelData(
  subject: string,
  body: string,
  attachmentText?: string
): Promise<ExtractionResult> {
  const prompt = buildExtractionPrompt(subject, body, attachmentText)

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: TRAVEL_EXTRACTION_SYSTEM_PROMPT,
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
    return normalizeExtractionResult(result)
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

function normalizeExtractionResult(result: ExtractionResult): ExtractionResult {
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
    const start_date = normalizeDate(item.start_date)
    const end_date = item.end_date ? normalizeDate(item.end_date) : null

    return {
      ...item,
      kind,
      status,
      confidence,
      needs_review,
      start_date: start_date || new Date().toISOString().split('T')[0],
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

function normalizeDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null

  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return null
    return date.toISOString().split('T')[0]
  } catch {
    return null
  }
}
