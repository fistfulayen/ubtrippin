/**
 * Field sanitizers for REST API v1 responses.
 *
 * Strip fields that are internal-only or contain PII that should never
 * appear in external API responses:
 *   - confirmation_code
 *   - source_email_id
 *   - details_json.booking_reference
 */

type RawTrip = Record<string, unknown>
type RawItem = Record<string, unknown>

/** Sanitize a trip row for public API consumption. */
export function sanitizeTrip(trip: RawTrip): RawTrip {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { ...safe } = trip
  return safe
}

/** Sanitize a trip_item row for public API consumption. */
export function sanitizeItem(item: RawItem): RawItem {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { confirmation_code, source_email_id, details_json, ...safe } = item

  // Strip booking_reference from details_json but keep everything else
  let cleanDetails: Record<string, unknown> | null = null
  if (details_json && typeof details_json === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { booking_reference, ...rest } = details_json as Record<string, unknown>
    cleanDetails = rest
  }

  return {
    ...safe,
    ...(cleanDetails !== null ? { details_json: cleanDetails } : {}),
  }
}
