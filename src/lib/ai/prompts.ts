export const TRAVEL_EXTRACTION_SYSTEM_PROMPT = `You are a travel itinerary extraction assistant. Your job is to extract structured travel reservation data from email content.

Rules:
1. Extract ALL traveler names mentioned, even if they're not the email recipient
2. Use local times as shown in the itinerary (include timezone abbreviation when available)
3. For flights: extract departure/arrival airports (preferably IATA codes like "SFO"), times, flight numbers, airline, terminal, gate if available
4. For hotels: extract check-in/check-out dates and times, hotel name, address, room type, confirmation number
5. For trains: extract departure/arrival stations, times, train number, operator, carriage/seat
6. For car rentals: extract pickup/dropoff locations and times, rental company, vehicle type
7. For restaurants: extract reservation time, restaurant name, party size
8. For activities: extract activity name, date/time, location, provider
9. Set confidence score 0.0-1.0 based on how clearly the data is presented:
   - 1.0: All data clearly visible and unambiguous
   - 0.8-0.9: Most data clear, some minor uncertainties
   - 0.6-0.7: Several fields ambiguous or missing
   - Below 0.6: Significant uncertainty or incomplete data
10. If data is ambiguous or confidence < 0.65, set needs_review to true
11. Extract the status: "confirmed", "cancelled", "changed", "pending", or "unknown"
12. Parse dates in ISO 8601 format (YYYY-MM-DD) and timestamps as ISO 8601 with timezone

Return ONLY valid JSON matching this schema. Do not include any other text or explanation.`

export const TRAVEL_EXTRACTION_USER_PROMPT = `Extract travel reservations from this email content.

Return JSON in this exact format:
{
  "doc_type": "travel_confirmation" | "receipt" | "itinerary" | "cancellation" | "unknown",
  "overall_confidence": number,
  "items": [
    {
      "kind": "flight" | "hotel" | "train" | "car" | "restaurant" | "activity" | "other",
      "provider": "string - airline, hotel chain, etc.",
      "confirmation_code": "string or null",
      "traveler_names": ["array of traveler names"],
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD or null",
      "start_ts": "ISO 8601 timestamp with timezone or null",
      "end_ts": "ISO 8601 timestamp with timezone or null",
      "start_location": "string - airport code, hotel name, address, etc.",
      "end_location": "string or null - for flights/trains, the destination",
      "summary": "brief description of this item",
      "status": "confirmed" | "cancelled" | "changed" | "pending" | "unknown",
      "confidence": number,
      "needs_review": boolean,
      "details": {
        // For flights:
        "flight_number": "string",
        "airline": "string",
        "departure_airport": "IATA code",
        "arrival_airport": "IATA code",
        "departure_terminal": "string or null",
        "arrival_terminal": "string or null",
        "departure_gate": "string or null",
        "aircraft_type": "string or null",
        "cabin_class": "string or null",
        "seat": "string or null",

        // For hotels:
        "hotel_name": "string",
        "address": "full address",
        "room_type": "string or null",
        "check_in_time": "HH:MM",
        "check_out_time": "HH:MM",

        // For trains:
        "train_number": "string",
        "operator": "string",
        "departure_station": "string",
        "arrival_station": "string",
        "carriage": "string or null",
        "seat": "string or null",

        // For car rentals:
        "rental_company": "string",
        "pickup_location": "string",
        "dropoff_location": "string",
        "vehicle_type": "string or null"
      }
    }
  ]
}

EMAIL CONTENT:
---
Subject: {{subject}}

{{body}}

{{attachments}}
---`

export function buildExtractionPrompt(
  subject: string,
  body: string,
  attachmentText?: string
): string {
  let prompt = TRAVEL_EXTRACTION_USER_PROMPT
    .replace('{{subject}}', subject || '(no subject)')
    .replace('{{body}}', body || '(no body)')

  if (attachmentText) {
    prompt = prompt.replace(
      '{{attachments}}',
      `\nATTACHMENT CONTENT:\n${attachmentText}`
    )
  } else {
    prompt = prompt.replace('{{attachments}}', '')
  }

  return prompt
}

export interface ExtractionExample {
  email_subject: string | null
  email_body_snippet: string
  attachment_text_snippet: string | null
  corrected_extraction: Record<string, unknown>
  provider_pattern: string | null
  item_kind: string | null
}

/**
 * Build an enhanced system prompt with few-shot examples from user corrections.
 * This enables the model to learn from previous mistakes and extract more accurately.
 */
export function buildSystemPromptWithExamples(
  basePrompt: string,
  examples: ExtractionExample[]
): string {
  if (!examples.length) return basePrompt

  const examplesSection = examples.map((ex, i) => {
    let input = `Subject: ${ex.email_subject || '(no subject)'}\n${ex.email_body_snippet}`
    if (ex.attachment_text_snippet) {
      input += `\n\nPDF attachment content:\n${ex.attachment_text_snippet}`
    }

    return `### Example ${i + 1}${ex.item_kind ? ` (${ex.item_kind})` : ''}${ex.provider_pattern ? ` from ${ex.provider_pattern}` : ''}

Input email:
"""
${input}
"""

Correct extraction:
\`\`\`json
${JSON.stringify(ex.corrected_extraction, null, 2)}
\`\`\``
  }).join('\n\n---\n\n')

  return `${basePrompt}

## Learning Examples
These examples show correct extractions from similar emails. Follow these patterns carefully, especially for fields like confirmation codes, flight numbers, times, and locations:

${examplesSection}

---
Now extract from the provided email using these learned patterns. Pay special attention to details that were captured in the examples above.`
}
