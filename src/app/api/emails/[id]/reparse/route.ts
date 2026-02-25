import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSecretClient } from '@/lib/supabase/service'
import { extractTravelData } from '@/lib/ai/extract-travel-data'
import { assignToTrip, updateTripDates, collectTravelerNames } from '@/lib/trips/assignment'
import { isValidUUID } from '@/lib/validation'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // SECURITY: Validate id is a well-formed UUID
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

  // Use service client for updates
  const secretClient = createSecretClient()

  // Update status to processing
  await secretClient
    .from('source_emails')
    .update({ parse_status: 'processing', parse_error: null })
    .eq('id', id)

  try {
    // Run AI extraction
    const extractionResult = await extractTravelData(
      email.subject || '',
      email.body_text || email.body_html || ''
    )

    // Update source email with extraction result
    await secretClient
      .from('source_emails')
      .update({
        extracted_json: extractionResult,
        parse_status: extractionResult.items.length > 0 ? 'completed' : 'failed',
        parse_error: extractionResult.items.length === 0 ? 'No travel items found' : null,
      })
      .eq('id', id)

    if (extractionResult.items.length === 0) {
      return NextResponse.json({
        message: 'No travel items extracted',
        items_created: 0,
      })
    }

    // SECURITY: Explicitly filter by user_id for defense-in-depth (RLS also enforces this)
    const { data: existingTrips } = await supabase
      .from('trips')
      .select('id, title, start_date, end_date, primary_location')
      .eq('user_id', user.id)

    // Create items
    let itemsCreated = 0

    for (const item of extractionResult.items) {
      const assignment = assignToTrip(item, existingTrips || [])
      let tripId = assignment.tripId

      // Create new trip if needed
      if (!tripId) {
        const { data: newTrip, error: tripError } = await secretClient
          .from('trips')
          .insert({
            user_id: user.id,
            title: assignment.tripTitle || 'Untitled Trip',
            start_date: item.start_date,
            end_date: item.end_date,
            primary_location: item.end_location || item.start_location,
            travelers: item.traveler_names || [],
          })
          .select()
          .single()

        if (tripError) continue
        tripId = newTrip.id

        existingTrips?.push({
          id: newTrip.id,
          title: newTrip.title,
          start_date: newTrip.start_date,
          end_date: newTrip.end_date,
          primary_location: newTrip.primary_location,
        })
      }

      // Create trip item
      const { error: itemError } = await secretClient.from('trip_items').insert({
        user_id: user.id,
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
        confidence: item.confidence,
        needs_review: item.needs_review,
        source_email_id: email.id,
      })

      if (!itemError) {
        itemsCreated++

        // Update trip dates
        const trip = existingTrips?.find((t) => t.id === tripId)
        if (trip) {
          const newDates = updateTripDates(trip, item)
          await secretClient
            .from('trips')
            .update({
              start_date: newDates.start_date,
              end_date: newDates.end_date,
            })
            .eq('id', tripId)
        }
      }
    }

    return NextResponse.json({
      message: 'Re-parse completed',
      items_created: itemsCreated,
    })
  } catch (error) {
    await secretClient
      .from('source_emails')
      .update({
        parse_status: 'failed',
        parse_error: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', id)

    return NextResponse.json(
      { error: 'Re-parse failed' },
      { status: 500 }
    )
  }
}
