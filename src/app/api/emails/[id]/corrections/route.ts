import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSecretClient } from '@/lib/supabase/server'
import { createEmailSnippet } from '@/lib/ai/example-selection'
import type { ExtractedItem } from '@/lib/ai/extract-travel-data'
import type { Json } from '@/types/database'
import { isValidUUID } from '@/lib/validation'

interface CorrectionRequest {
  corrected_items: ExtractedItem[]
  create_example: boolean
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // SECURITY: Validate that id is a well-formed UUID before using it in queries
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Invalid email ID' }, { status: 400 })
  }

  // Verify user is authenticated
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get the email
  const { data: email, error } = await supabase
    .from('source_emails')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !email) {
    return NextResponse.json({ error: 'Email not found' }, { status: 404 })
  }

  let body: CorrectionRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { corrected_items, create_example } = body

  if (!Array.isArray(corrected_items)) {
    return NextResponse.json({ error: 'corrected_items must be an array' }, { status: 400 })
  }

  // SECURITY: Cap the number of items that can be submitted to prevent large payload abuse
  const MAX_ITEMS = 50
  if (corrected_items.length > MAX_ITEMS) {
    return NextResponse.json(
      { error: `Too many items (max ${MAX_ITEMS})` },
      { status: 400 }
    )
  }

  const secretClient = createSecretClient()
  const originalItems = (email.extracted_json as { items?: ExtractedItem[] })?.items || []

  try {
    // 1. Calculate and save individual corrections for analytics
    const corrections = computeCorrections(originalItems, corrected_items)

    if (corrections.length > 0) {
      await secretClient.from('extraction_corrections').insert(
        corrections.map((c) => ({
          user_id: user.id,
          source_email_id: id,
          field_path: c.field_path,
          original_value: c.original_value as Json,
          corrected_value: c.corrected_value as Json,
          correction_type: c.correction_type,
        }))
      )
    }

    // 2. Update source_emails.extracted_json with corrected version
    const updatedExtraction = {
      ...(email.extracted_json as Record<string, unknown>),
      items: corrected_items,
    }

    await secretClient
      .from('source_emails')
      .update({ extracted_json: updatedExtraction })
      .eq('id', id)

    // 3. Update/create trip_items based on corrected data
    await syncTripItems(secretClient, user.id, id, corrected_items)

    // 4. Create learning example if requested
    if (create_example && corrected_items.length > 0) {
      await createExtractionExample(
        secretClient,
        user.id,
        email,
        corrected_items
      )
    }

    return NextResponse.json({
      success: true,
      corrections_saved: corrections.length,
      example_created: create_example,
    })
  } catch (error) {
    console.error('Failed to save corrections:', error)
    return NextResponse.json(
      { error: 'Failed to save corrections' },
      { status: 500 }
    )
  }
}

interface Correction {
  field_path: string
  original_value: unknown
  corrected_value: unknown
  correction_type: 'added' | 'modified' | 'removed'
}

function computeCorrections(
  original: ExtractedItem[],
  corrected: ExtractedItem[]
): Correction[] {
  const corrections: Correction[] = []

  // Compare items by index (simplified approach)
  const maxLength = Math.max(original.length, corrected.length)

  for (let i = 0; i < maxLength; i++) {
    const origItem = original[i]
    const corrItem = corrected[i]

    if (!origItem && corrItem) {
      // New item added
      corrections.push({
        field_path: `items[${i}]`,
        original_value: null,
        corrected_value: corrItem,
        correction_type: 'added',
      })
      continue
    }

    if (origItem && !corrItem) {
      // Item removed
      corrections.push({
        field_path: `items[${i}]`,
        original_value: origItem,
        corrected_value: null,
        correction_type: 'removed',
      })
      continue
    }

    if (!origItem || !corrItem) continue

    // Compare fields
    const fieldsToCompare: (keyof ExtractedItem)[] = [
      'kind',
      'provider',
      'confirmation_code',
      'start_date',
      'end_date',
      'start_ts',
      'end_ts',
      'start_location',
      'end_location',
      'summary',
      'status',
    ]

    for (const field of fieldsToCompare) {
      const origValue = origItem[field]
      const corrValue = corrItem[field]

      if (JSON.stringify(origValue) !== JSON.stringify(corrValue)) {
        const correctionType = origValue == null && corrValue != null
          ? 'added'
          : origValue != null && corrValue == null
          ? 'removed'
          : 'modified'

        corrections.push({
          field_path: `items[${i}].${field}`,
          original_value: origValue,
          corrected_value: corrValue,
          correction_type: correctionType,
        })
      }
    }

    // Compare traveler_names array
    const origTravelers = JSON.stringify(origItem.traveler_names || [])
    const corrTravelers = JSON.stringify(corrItem.traveler_names || [])
    if (origTravelers !== corrTravelers) {
      corrections.push({
        field_path: `items[${i}].traveler_names`,
        original_value: origItem.traveler_names,
        corrected_value: corrItem.traveler_names,
        correction_type: 'modified',
      })
    }

    // Compare details object
    const origDetails = JSON.stringify(origItem.details || {})
    const corrDetails = JSON.stringify(corrItem.details || {})
    if (origDetails !== corrDetails) {
      corrections.push({
        field_path: `items[${i}].details`,
        original_value: origItem.details,
        corrected_value: corrItem.details,
        correction_type: 'modified',
      })
    }
  }

  return corrections
}

async function syncTripItems(
  supabase: ReturnType<typeof createSecretClient>,
  userId: string,
  emailId: string,
  items: ExtractedItem[]
) {
  // Get existing trip items for this email
  const { data: existingItems } = await supabase
    .from('trip_items')
    .select('id, kind, confirmation_code')
    .eq('source_email_id', emailId)

  // Simple approach: update existing items and create new ones as needed
  // For more sophisticated matching, could compare confirmation_code + kind

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const existingItem = existingItems?.[i]

    if (existingItem) {
      // Update existing item
      await supabase
        .from('trip_items')
        .update({
          kind: item.kind,
          provider: item.provider,
          confirmation_code: item.confirmation_code,
          traveler_names: item.traveler_names || [],
          start_date: item.start_date,
          end_date: item.end_date,
          start_ts: item.start_ts,
          end_ts: item.end_ts,
          start_location: item.start_location,
          end_location: item.end_location,
          summary: item.summary,
          details_json: item.details || {},
          status: item.status,
          confidence: 1.0, // User-corrected = high confidence
          needs_review: false,
        })
        .eq('id', existingItem.id)
    } else {
      // Need to find or create a trip first
      const { data: trips } = await supabase
        .from('trips')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)

      let tripId = trips?.[0]?.id

      if (!tripId) {
        // Create a new trip
        const { data: newTrip } = await supabase
          .from('trips')
          .insert({
            user_id: userId,
            title: `Trip to ${item.end_location || item.start_location || 'Unknown'}`,
            start_date: item.start_date,
            end_date: item.end_date,
            primary_location: item.end_location || item.start_location,
          })
          .select()
          .single()

        tripId = newTrip?.id
      }

      if (tripId) {
        // Create new item
        await supabase.from('trip_items').insert({
          user_id: userId,
          trip_id: tripId,
          kind: item.kind,
          provider: item.provider,
          confirmation_code: item.confirmation_code,
          traveler_names: item.traveler_names || [],
          start_date: item.start_date,
          end_date: item.end_date,
          start_ts: item.start_ts,
          end_ts: item.end_ts,
          start_location: item.start_location,
          end_location: item.end_location,
          summary: item.summary,
          details_json: item.details || {},
          status: item.status,
          confidence: 1.0,
          needs_review: false,
          source_email_id: emailId,
        })
      }
    }
  }

  // Remove items that no longer exist
  if (existingItems && existingItems.length > items.length) {
    const idsToRemove = existingItems.slice(items.length).map((item) => item.id)
    await supabase.from('trip_items').delete().in('id', idsToRemove)
  }
}

async function createExtractionExample(
  supabase: ReturnType<typeof createSecretClient>,
  userId: string,
  email: {
    id: string
    subject: string | null
    body_text: string | null
    body_html: string | null
    attachment_text?: string | null
    from_email: string
  },
  correctedItems: ExtractedItem[]
) {
  // Extract provider pattern from email address
  const senderDomain = email.from_email.split('@')[1]?.toLowerCase()

  // Determine primary item kind
  const itemKind = correctedItems[0]?.kind || null

  // Create snippets (anonymized/truncated)
  const bodyText = email.body_text || email.body_html || ''
  const emailBodySnippet = createEmailSnippet(bodyText, 500)
  const attachmentTextSnippet = email.attachment_text
    ? createEmailSnippet(email.attachment_text, 300)
    : null

  // Build the corrected extraction object
  const correctedExtraction = {
    doc_type: 'travel_confirmation',
    overall_confidence: 1.0,
    items: correctedItems,
  }

  await supabase.from('extraction_examples').insert({
    user_id: userId,
    source_email_id: email.id,
    email_subject: email.subject,
    email_body_snippet: emailBodySnippet,
    attachment_text_snippet: attachmentTextSnippet,
    corrected_extraction: correctedExtraction,
    provider_pattern: senderDomain,
    item_kind: itemKind,
    is_global: false, // Only user's own examples by default
  })
}
