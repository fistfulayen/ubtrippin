import { normalizeCoverImageUrl } from '@/lib/images/cover-url'

/**
 * Field sanitizers for REST API v1 responses and write inputs.
 *
 * Output sanitizers strip fields that are internal-only or contain PII:
 *   - confirmation_code
 *   - source_email_id
 *   - details_json.booking_reference
 *
 * Input sanitizers validate and clean user-supplied write bodies before
 * they touch the database.
 */

type RawTrip = Record<string, unknown>
type RawItem = Record<string, unknown>

const SHARED_SECRET_KEYS = new Set([
  'confirmation_code',
  'confirmation_number',
  'booking_reference',
  'booking_ref',
  'record_locator',
  'pnr',
  'ticket_pdf_bucket',
  'ticket_pdf_path',
  'storage_bucket',
  'storage_path',
  'barcode',
  'barcode_data',
  'qr_code',
])

function redactSharedSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSharedSecrets)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !SHARED_SECRET_KEYS.has(key.toLowerCase()))
      .map(([key, child]) => [key, redactSharedSecrets(child)])
  )
}

const PUBLIC_DETAIL_FIELDS: Record<string, ReadonlySet<string>> = {
  flight: new Set(['airline', 'flight_number', 'departure_airport', 'arrival_airport', 'departure_city', 'arrival_city', 'departure_local_time', 'arrival_local_time', 'departure_terminal', 'arrival_terminal', 'duration']),
  hotel: new Set(['hotel_name', 'check_in_date', 'check_in_time', 'check_out_date', 'check_out_time', 'city', 'country']),
  train: new Set(['train_number', 'operator', 'departure_station', 'arrival_station', 'departure_local_time', 'arrival_local_time', 'duration']),
  car_rental: new Set(['rental_company', 'pickup_location', 'dropoff_location', 'pickup_time', 'dropoff_time', 'vehicle_type']),
  restaurant: new Set(['restaurant_name', 'reservation_time']),
  activity: new Set(['activity_name', 'venue', 'start_time', 'end_time']),
  ticket: new Set(['event_name', 'venue', 'date', 'time']),
  other: new Set(),
}

export function sanitizePublicItemDetails(
  kind: string,
  details: unknown
): Record<string, unknown> {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return {}
  const allowed = PUBLIC_DETAIL_FIELDS[kind] ?? PUBLIC_DETAIL_FIELDS.other
  return Object.fromEntries(
    Object.entries(details as Record<string, unknown>)
      .filter(([key]) => allowed.has(key))
      .map(([key, value]) => [key, redactSharedSecrets(value)])
  )
}

// ---------------------------------------------------------------------------
// Response sanitizers (GET)
// ---------------------------------------------------------------------------

/** Sanitize a trip row for public API consumption. */
export function sanitizeTrip(trip: RawTrip): RawTrip {
  return { ...trip }
}

/** Sanitize a trip_item row for public API consumption. */
export function sanitizeItem(item: RawItem): RawItem {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { confirmation_code, source_email_id, details_json, ...safe } = item

  // Recursively strip reservation capabilities and server-owned locators.
  let cleanDetails: Record<string, unknown> | null = null
  if (details_json && typeof details_json === 'object') {
    cleanDetails = redactSharedSecrets(details_json) as Record<string, unknown>
  }

  return {
    ...safe,
    ...(cleanDetails !== null ? { details_json: cleanDetails } : {}),
  }
}

// ---------------------------------------------------------------------------
// Input sanitizers (POST / PATCH)
// ---------------------------------------------------------------------------

/** Strip HTML tags from a string. */
function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '').trim()
}

/** Validate ISO date string (YYYY-MM-DD). */
function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value))
}

/** Validate ISO 8601 timestamp. */
function isValidIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  return !isNaN(Date.parse(value))
}

/** Clean a nullable string field: strip HTML, trim, enforce max length. */
function cleanString(value: unknown, maxLen: number): string | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value !== 'string') return undefined
  const clean = stripHtml(value)
  if (clean.length > maxLen) return undefined
  return clean
}

export interface TripInputError {
  code: 'invalid_param'
  message: string
  field: string
}

export interface SanitizedTripInput {
  title?: string
  start_date?: string | null
  end_date?: string | null
  primary_location?: string | null
  notes?: string | null
  cover_image_url?: string | null
  share_enabled?: boolean
}

/**
 * Sanitize and validate a trip write body (POST / PATCH).
 * Returns { data } on success or { error } on validation failure.
 */
export function sanitizeTripInput(
  body: Record<string, unknown>,
  requireTitle = false
): { data: SanitizedTripInput } | { error: TripInputError } {
  const out: SanitizedTripInput = {}

  // title
  if (body.title !== undefined) {
    if (typeof body.title !== 'string') {
      return { error: { code: 'invalid_param', field: 'title', message: '"title" must be a string.' } }
    }
    const title = stripHtml(body.title)
    if (title.length < 1 || title.length > 200) {
      return { error: { code: 'invalid_param', field: 'title', message: '"title" must be 1–200 characters.' } }
    }
    out.title = title
  } else if (requireTitle) {
    return { error: { code: 'invalid_param', field: 'title', message: '"title" is required.' } }
  }

  // start_date / end_date
  for (const field of ['start_date', 'end_date'] as const) {
    if (body[field] !== undefined) {
      if (body[field] === null) {
        out[field] = null
      } else if (!isValidIsoDate(body[field])) {
        return { error: { code: 'invalid_param', field, message: `"${field}" must be a valid ISO date (YYYY-MM-DD).` } }
      } else {
        out[field] = body[field] as string
      }
    }
  }

  // primary_location
  if (body.primary_location !== undefined) {
    if (body.primary_location === null) {
      out.primary_location = null
    } else {
      const val = cleanString(body.primary_location, 200)
      if (val === undefined) {
        return { error: { code: 'invalid_param', field: 'primary_location', message: '"primary_location" must be a string ≤200 chars.' } }
      }
      out.primary_location = val || null
    }
  }

  // notes
  if (body.notes !== undefined) {
    if (body.notes === null) {
      out.notes = null
    } else {
      const val = cleanString(body.notes, 5000)
      if (val === undefined) {
        return { error: { code: 'invalid_param', field: 'notes', message: '"notes" must be a string ≤5000 chars.' } }
      }
      out.notes = val || null
    }
  }

  // cover_image_url
  if (body.cover_image_url !== undefined) {
    if (body.cover_image_url === null) {
      out.cover_image_url = null
    } else {
      const val = cleanString(body.cover_image_url, 500)
      if (val === undefined) {
        return { error: { code: 'invalid_param', field: 'cover_image_url', message: '"cover_image_url" must be a string ≤500 chars.' } }
      }
      if (!val) {
        out.cover_image_url = null
      } else {
        const normalizedUrl = normalizeCoverImageUrl(val)
        if (!normalizedUrl) {
          return { error: { code: 'invalid_param', field: 'cover_image_url', message: '"cover_image_url" must be an application-managed or Unsplash image URL.' } }
        }
        out.cover_image_url = normalizedUrl
      }
    }
  }

  // share_enabled
  if (body.share_enabled !== undefined) {
    if (typeof body.share_enabled !== 'boolean') {
      return { error: { code: 'invalid_param', field: 'share_enabled', message: '"share_enabled" must be a boolean.' } }
    }
    out.share_enabled = body.share_enabled
  }

  return { data: out }
}

// ---------------------------------------------------------------------------

const VALID_ITEM_KINDS = ['flight', 'hotel', 'car_rental', 'train', 'activity', 'restaurant', 'ticket', 'other'] as const
type ItemKind = (typeof VALID_ITEM_KINDS)[number]

const DETAILS_JSON_MAX_BYTES = 10 * 1024 // 10KB
const TRAVELER_NAMES_MAX = 20
const TRAVELER_NAME_MAX_LEN = 200

export interface SanitizedItemInput {
  kind?: ItemKind
  provider?: string | null
  confirmation_code?: string | null
  summary?: string | null
  traveler_names?: string[] | null
  start_ts?: string | null
  end_ts?: string | null
  start_date?: string | null
  end_date?: string | null
  start_location?: string | null
  end_location?: string | null
  details_json?: Record<string, unknown> | null
  status?: string | null
  confidence?: number | null
  needs_review?: boolean | null
}

export interface ItemInputError {
  code: 'invalid_param'
  message: string
  field: string
}

/**
 * Sanitize and validate a trip item write body (POST / PATCH).
 * Returns { data } on success or { error } on validation failure.
 */
export function sanitizeItemInput(
  body: Record<string, unknown>,
  requireKindAndDate = false
): { data: SanitizedItemInput } | { error: ItemInputError } {
  const out: SanitizedItemInput = {}

  // kind
  if (body.kind !== undefined) {
    if (!VALID_ITEM_KINDS.includes(body.kind as ItemKind)) {
      return {
        error: {
          code: 'invalid_param',
          field: 'kind',
          message: `"kind" must be one of: ${VALID_ITEM_KINDS.join(', ')}.`,
        },
      }
    }
    out.kind = body.kind as ItemKind
  } else if (requireKindAndDate) {
    return { error: { code: 'invalid_param', field: 'kind', message: '"kind" is required.' } }
  }

  // start_date (required on create)
  if (body.start_date !== undefined) {
    if (body.start_date === null) {
      out.start_date = null
    } else if (!isValidIsoDate(body.start_date)) {
      return { error: { code: 'invalid_param', field: 'start_date', message: '"start_date" must be a valid ISO date (YYYY-MM-DD).' } }
    } else {
      out.start_date = body.start_date as string
    }
  } else if (requireKindAndDate) {
    return { error: { code: 'invalid_param', field: 'start_date', message: '"start_date" is required.' } }
  }

  // end_date
  if (body.end_date !== undefined) {
    if (body.end_date === null) {
      out.end_date = null
    } else if (!isValidIsoDate(body.end_date)) {
      return { error: { code: 'invalid_param', field: 'end_date', message: '"end_date" must be a valid ISO date (YYYY-MM-DD).' } }
    } else {
      out.end_date = body.end_date as string
    }
  }

  // Timestamp fields: start_ts, end_ts
  for (const field of ['start_ts', 'end_ts'] as const) {
    if (body[field] !== undefined) {
      if (body[field] === null) {
        out[field] = null
      } else if (!isValidIsoTimestamp(body[field])) {
        return { error: { code: 'invalid_param', field, message: `"${field}" must be a valid ISO 8601 timestamp.` } }
      } else {
        out[field] = body[field] as string
      }
    }
  }

  // String fields
  const stringFields: Array<[keyof SanitizedItemInput, number]> = [
    ['provider', 200],
    ['confirmation_code', 200],
    ['summary', 1000],
    ['start_location', 300],
    ['end_location', 300],
  ]

  for (const [field, maxLen] of stringFields) {
    if (body[field] !== undefined) {
      if (body[field] === null) {
        out[field] = null as never
      } else {
        const val = cleanString(body[field], maxLen)
        if (val === undefined) {
          return { error: { code: 'invalid_param', field: field as string, message: `"${field as string}" must be a string ≤${maxLen} chars.` } }
        }
        out[field] = (val || null) as never
      }
    }
  }

  // traveler_names
  if (body.traveler_names !== undefined) {
    if (body.traveler_names === null) {
      out.traveler_names = null
    } else if (!Array.isArray(body.traveler_names)) {
      return { error: { code: 'invalid_param', field: 'traveler_names', message: '"traveler_names" must be an array of strings.' } }
    } else {
      if (body.traveler_names.length > TRAVELER_NAMES_MAX) {
        return { error: { code: 'invalid_param', field: 'traveler_names', message: `"traveler_names" may contain at most ${TRAVELER_NAMES_MAX} entries.` } }
      }
      const names: string[] = []
      for (const name of body.traveler_names) {
        if (typeof name !== 'string') {
          return { error: { code: 'invalid_param', field: 'traveler_names', message: '"traveler_names" must be an array of strings.' } }
        }
        const clean = stripHtml(name)
        if (clean.length > TRAVELER_NAME_MAX_LEN) {
          return { error: { code: 'invalid_param', field: 'traveler_names', message: `Each entry in "traveler_names" must be ≤${TRAVELER_NAME_MAX_LEN} chars.` } }
        }
        names.push(clean)
      }
      out.traveler_names = names
    }
  }

  // details_json
  if (body.details_json !== undefined) {
    if (body.details_json === null) {
      out.details_json = null
    } else if (typeof body.details_json !== 'object' || Array.isArray(body.details_json)) {
      return { error: { code: 'invalid_param', field: 'details_json', message: '"details_json" must be a JSON object.' } }
    } else {
      const details = body.details_json as Record<string, unknown>
      if ('ticket_pdf_bucket' in details || 'ticket_pdf_path' in details) {
        return { error: { code: 'invalid_param', field: 'details_json', message: 'Ticket attachment locators are server-managed.' } }
      }
      const jsonStr = JSON.stringify(body.details_json)
      if (Buffer.byteLength(jsonStr, 'utf8') > DETAILS_JSON_MAX_BYTES) {
        return { error: { code: 'invalid_param', field: 'details_json', message: '"details_json" must not exceed 10KB.' } }
      }
      out.details_json = details
    }
  }

  // status
  if (body.status !== undefined) {
    if (body.status === null) {
      out.status = null
    } else {
      const val = cleanString(body.status, 50)
      if (val === undefined) {
        return { error: { code: 'invalid_param', field: 'status', message: '"status" must be a string ≤50 chars.' } }
      }
      out.status = val || null
    }
  }

  // confidence (0–1 float)
  if (body.confidence !== undefined) {
    if (body.confidence === null) {
      out.confidence = null
    } else {
      const n = Number(body.confidence)
      if (!Number.isFinite(n) || n < 0 || n > 1) {
        return { error: { code: 'invalid_param', field: 'confidence', message: '"confidence" must be a number between 0 and 1.' } }
      }
      out.confidence = n
    }
  }

  // needs_review
  if (body.needs_review !== undefined) {
    if (body.needs_review === null) {
      out.needs_review = null
    } else if (typeof body.needs_review !== 'boolean') {
      return { error: { code: 'invalid_param', field: 'needs_review', message: '"needs_review" must be a boolean.' } }
    } else {
      out.needs_review = body.needs_review
    }
  }

  return { data: out }
}
