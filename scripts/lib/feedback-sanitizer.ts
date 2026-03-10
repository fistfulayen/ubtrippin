/**
 * PRD-044 Phase 2b: Feedback Triage Sanitizer
 *
 * Wraps feedback title+body in delimiter isolation before AI triage.
 * Returns structured extraction result, never raw user text.
 *
 * Usage: called by the feedback triage cron instead of reading raw text.
 */

import {
  buildExtractionPrompt,
  validateExtractionOutput,
  validateInput,
  FEEDBACK_EXTRACTION_SCHEMA,
  FEEDBACK_FIELDS,
} from '@/lib/sanitize/pipeline'

export interface FeedbackItem {
  id: string
  title: string
  body: string
  type: string
  status: string
  created_at: string
  user_id: string
  image_url?: string | null
}

export interface SanitizedFeedback {
  id: string
  type: string
  status: string
  created_at: string
  /** Structured extraction from AI — never raw user text */
  extraction: {
    summary: string | null
    category: string
    severity: string
    affected_component: string | null
    screenshot_description: string | null
    reproduction_steps: string[] | null
  } | null
  /** Gate validation passed */
  gateOk: boolean
  /** Why gate rejected (if applicable) */
  gateError?: string
  /** Raw title preserved for display — but NEVER injected into AI prompts */
  displayTitle: string
}

/**
 * Run input gate validation on a feedback item.
 * Returns sanitized text and content hash.
 */
export function gateFeedback(item: FeedbackItem): SanitizedFeedback {
  const combined = `${item.title}\n\n${item.body}`
  const gateResult = validateInput('feedback', combined)

  if (!gateResult.ok) {
    return {
      id: item.id,
      type: item.type,
      status: item.status,
      created_at: item.created_at,
      extraction: null,
      gateOk: false,
      gateError: gateResult.error,
      displayTitle: item.title.slice(0, 200),
    }
  }

  return {
    id: item.id,
    type: item.type,
    status: item.status,
    created_at: item.created_at,
    extraction: null, // filled after AI extraction
    gateOk: true,
    displayTitle: item.title.slice(0, 200),
  }
}

/**
 * Build the AI extraction prompt for a feedback item.
 * User content is wrapped in delimiter tags with injection defense.
 *
 * The AI should call this and send the result to the model.
 * The response must then be validated with validateFeedbackExtraction().
 */
export function buildFeedbackExtractionPrompt(item: FeedbackItem): string {
  const userContent = `Title: ${item.title}\n\nDetails: ${item.body}`
  return buildExtractionPrompt(
    userContent,
    FEEDBACK_EXTRACTION_SCHEMA,
    `This is feedback submitted by a user of UB Trippin, a travel organizer app. Extract structured data about what they're reporting.`
  )
}

/**
 * Validate the AI's extraction response.
 * Returns the structured data if valid, or an error if not.
 */
export function validateFeedbackExtraction(aiResponse: string) {
  return validateExtractionOutput(aiResponse, FEEDBACK_FIELDS)
}

/**
 * Build a safe triage summary for the cron agent.
 * Contains structured extraction data, NEVER raw user text in prompt position.
 */
export function buildTriageSummary(items: SanitizedFeedback[]): string {
  if (items.length === 0) return 'No new feedback to triage.'

  const lines = items.map((item, i) => {
    if (!item.gateOk) {
      return `${i + 1}. [GATE REJECTED] id:${item.id.slice(0, 8)} — ${item.gateError}`
    }
    if (!item.extraction) {
      return `${i + 1}. [PENDING EXTRACTION] id:${item.id.slice(0, 8)} type:${item.type}`
    }
    const e = item.extraction
    return [
      `${i + 1}. id:${item.id.slice(0, 8)} type:${item.type} status:${item.status}`,
      `   Category: ${e.category} | Severity: ${e.severity}`,
      `   Summary: ${e.summary ?? '(none)'}`,
      e.affected_component ? `   Component: ${e.affected_component}` : null,
      e.reproduction_steps ? `   Steps: ${e.reproduction_steps.join(' → ')}` : null,
    ].filter(Boolean).join('\n')
  })

  return `=== SANITIZED FEEDBACK FOR TRIAGE (${items.length} items) ===\n\n${lines.join('\n\n')}\n\n=== END FEEDBACK ===`
}
