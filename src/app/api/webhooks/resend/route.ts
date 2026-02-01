import { NextRequest, NextResponse } from 'next/server'
import { createSecretClient } from '@/lib/supabase/server'
import { verifyWebhookSignature, type ResendEmailPayload } from '@/lib/resend/verify-webhook'
import { getResendClient } from '@/lib/resend/client'
import { extractTravelData } from '@/lib/ai/extract-travel-data'
import { extractTextFromPdf } from '@/lib/pdf/parse-attachment'
import {
  assignToTrip,
  updateTripDates,
  getPrimaryLocation,
  collectTravelerNames,
} from '@/lib/trips/assignment'
import { sanitizeHtml } from '@/lib/utils'
import { TripConfirmationEmail } from '@/components/email/trip-confirmation'
import { render } from '@react-email/components'

// Force dynamic rendering - webhooks must never be cached/static
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text()

    // Get Svix headers for verification
    const svixId = request.headers.get('svix-id')
    const svixTimestamp = request.headers.get('svix-timestamp')
    const svixSignature = request.headers.get('svix-signature')

    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json({ error: 'Missing webhook headers' }, { status: 400 })
    }

    // Verify webhook signature
    let emailData: ResendEmailPayload
    try {
      emailData = verifyWebhookSignature(payload, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      })
    } catch (error) {
      console.error('Webhook verification failed:', error)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // Only process email.received events
    if (emailData.type !== 'email.received') {
      return NextResponse.json({ message: 'Event type ignored' })
    }

    const supabase = createSecretClient()
    const { data: webhookData } = emailData

    // Webhook only contains metadata - fetch full email content from Resend API
    console.log('Fetching full email content for:', webhookData.email_id)
    const resend = getResendClient()
    const { data: fullEmail, error: fetchError } = await resend.emails.receiving.get(webhookData.email_id)

    if (fetchError || !fullEmail) {
      console.error('Failed to fetch email content:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch email content' }, { status: 500 })
    }

    console.log('Email fetched - text length:', fullEmail.text?.length || 0, 'html length:', fullEmail.html?.length || 0)

    // Extract sender email (removing display name if present)
    const fromEmail = fullEmail.from.match(/<(.+)>/)?.[1] || fullEmail.from

    // Look up user by sender email in allowed_senders
    const { data: allowedSender } = await supabase
      .from('allowed_senders')
      .select('user_id, profiles(id, email, full_name)')
      .eq('email', fromEmail.toLowerCase())
      .single()

    // Store the raw email with content from API
    const { data: sourceEmail, error: insertError } = await supabase
      .from('source_emails')
      .insert({
        user_id: allowedSender?.user_id || null,
        from_email: fromEmail,
        to_email: fullEmail.to?.[0] || null,
        subject: fullEmail.subject || null,
        body_text: fullEmail.text || null,
        body_html: fullEmail.html ? sanitizeHtml(fullEmail.html) : null,
        resend_message_id: webhookData.email_id,
        attachments_json: fullEmail.attachments?.map((a) => ({
          filename: a.filename,
          content_type: a.content_type,
        })) || [],
        parse_status: allowedSender ? 'processing' : 'unassigned',
        auth_results: {
          // Auth results come from webhook headers, not API response
          spf: fullEmail.headers?.['received-spf'] ? 'pass' : null,
          dkim: fullEmail.headers?.['dkim-signature'] ? 'pass' : null,
          dmarc: null,
        },
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to store email:', insertError)
      return NextResponse.json({ error: 'Failed to store email' }, { status: 500 })
    }

    // If no user found, stop processing but acknowledge receipt
    if (!allowedSender) {
      console.log(`Email from unrecognized sender: ${fromEmail}`)
      return NextResponse.json({
        message: 'Email stored but sender not recognized',
        email_id: sourceEmail.id,
      })
    }

    const userId = allowedSender.user_id
    // profiles may be an array or object depending on Supabase relationship
    const profilesData = allowedSender.profiles
    const userProfile = Array.isArray(profilesData)
      ? profilesData[0] as { email: string; full_name: string | null } | undefined
      : profilesData as { email: string; full_name: string | null } | null

    try {
      // Extract text from PDF attachments using Resend attachments API
      let attachmentText = ''
      if (fullEmail.attachments?.length) {
        for (const attachment of fullEmail.attachments) {
          if (attachment.content_type === 'application/pdf') {
            try {
              // Fetch attachment content via Resend API
              const { data: attachmentData } = await resend.emails.receiving.attachments.get({
                emailId: webhookData.email_id,
                id: attachment.id,
              })
              if (attachmentData?.download_url) {
                // Download and extract PDF text
                const pdfResponse = await fetch(attachmentData.download_url)
                const pdfBuffer = await pdfResponse.arrayBuffer()
                const pdfBase64 = Buffer.from(pdfBuffer).toString('base64')
                const text = await extractTextFromPdf(pdfBase64)
                if (text) {
                  attachmentText += `\n\n--- PDF: ${attachment.filename} ---\n${text}`
                }
              }
            } catch (pdfError) {
              console.error('Failed to extract PDF:', attachment.filename, pdfError)
            }
          }
        }
      }

      // Extract sender domain for example matching
      const senderDomain = fromEmail.split('@')[1]?.toLowerCase()

      // Run AI extraction with sender domain for few-shot matching
      const extractionResult = await extractTravelData(
        fullEmail.subject || '',
        fullEmail.text || fullEmail.html || '',
        attachmentText || undefined,
        { senderDomain }
      )

      // Update source email with extraction result and attachment text
      await supabase
        .from('source_emails')
        .update({
          extracted_json: extractionResult,
          attachment_text: attachmentText || null,
          parse_status: extractionResult.items.length > 0 ? 'completed' : 'failed',
          parse_error: extractionResult.items.length === 0 ? 'No travel items found' : null,
        })
        .eq('id', sourceEmail.id)

      if (extractionResult.items.length === 0) {
        return NextResponse.json({
          message: 'No travel items extracted',
          email_id: sourceEmail.id,
        })
      }

      // Get user's existing trips for assignment
      const { data: existingTrips } = await supabase
        .from('trips')
        .select('id, title, start_date, end_date, primary_location')
        .eq('user_id', userId)

      // Process each extracted item
      const createdItems: { tripId: string; itemId: string }[] = []
      const tripsToUpdate = new Map<string, { items: typeof extractionResult.items }>()

      for (const item of extractionResult.items) {
        // Determine trip assignment
        const assignment = assignToTrip(item, existingTrips || [])

        let tripId = assignment.tripId

        // Create new trip if needed
        if (!tripId) {
          const { data: newTrip, error: tripError } = await supabase
            .from('trips')
            .insert({
              user_id: userId,
              title: assignment.tripTitle || 'Untitled Trip',
              start_date: item.start_date,
              end_date: item.end_date,
              primary_location: item.end_location || item.start_location,
              travelers: item.traveler_names || [],
            })
            .select()
            .single()

          if (tripError) {
            console.error('Failed to create trip:', tripError)
            continue
          }

          tripId = newTrip.id

          // Add to existing trips for subsequent items
          existingTrips?.push({
            id: newTrip.id,
            title: newTrip.title,
            start_date: newTrip.start_date,
            end_date: newTrip.end_date,
            primary_location: newTrip.primary_location,
          })
        }

        // Track items per trip for date updates
        // tripId is guaranteed non-null here (created above if it was null)
        const confirmedTripId = tripId!
        if (!tripsToUpdate.has(confirmedTripId)) {
          tripsToUpdate.set(confirmedTripId, { items: [] })
        }
        tripsToUpdate.get(confirmedTripId)!.items.push(item)

        // Create trip item
        const { data: tripItem, error: itemError } = await supabase
          .from('trip_items')
          .insert({
            user_id: userId,
            trip_id: confirmedTripId,
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
            source_email_id: sourceEmail.id,
          })
          .select()
          .single()

        if (itemError) {
          console.error('Failed to create trip item:', itemError)
          continue
        }

        createdItems.push({ tripId: confirmedTripId, itemId: tripItem.id })
      }

      // Update trip dates and info for affected trips
      for (const [tripId, { items }] of tripsToUpdate) {
        const trip = existingTrips?.find((t) => t.id === tripId)
        if (!trip) continue

        const newDates = items.reduce(
          (dates, item) => updateTripDates(dates, item),
          { start_date: trip.start_date, end_date: trip.end_date }
        )

        const newLocation = getPrimaryLocation(items) || trip.primary_location
        const newTravelers = collectTravelerNames(items)

        // Merge travelers with existing
        const { data: existingTripData } = await supabase
          .from('trips')
          .select('travelers')
          .eq('id', tripId)
          .single()

        const mergedTravelers = Array.from(
          new Set([...(existingTripData?.travelers || []), ...newTravelers])
        )

        await supabase
          .from('trips')
          .update({
            start_date: newDates.start_date,
            end_date: newDates.end_date,
            primary_location: newLocation,
            travelers: mergedTravelers,
          })
          .eq('id', tripId)
      }

      // Send confirmation email
      if (createdItems.length > 0 && userProfile?.email) {
        await sendConfirmationEmail(
          userProfile.email,
          userProfile.full_name,
          createdItems,
          extractionResult.items,
          supabase
        )
      }

      return NextResponse.json({
        message: 'Email processed successfully',
        email_id: sourceEmail.id,
        items_created: createdItems.length,
      })
    } catch (error) {
      console.error('Processing error:', error)

      // Update source email with error
      await supabase
        .from('source_emails')
        .update({
          parse_status: 'failed',
          parse_error: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', sourceEmail.id)

      return NextResponse.json({
        message: 'Processing failed',
        email_id: sourceEmail.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function sendConfirmationEmail(
  userEmail: string,
  userName: string | null,
  createdItems: { tripId: string; itemId: string }[],
  items: Awaited<ReturnType<typeof extractTravelData>>['items'],
  supabase: ReturnType<typeof createSecretClient>
) {
  try {
    // Get trip details
    const tripId = createdItems[0].tripId
    const { data: trip } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single()

    if (!trip) return

    const resend = getResendClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ubtrippin.xyz'

    const emailHtml = await render(
      TripConfirmationEmail({
        userName: userName || 'Traveler',
        tripTitle: trip.title,
        tripStartDate: trip.start_date,
        tripEndDate: trip.end_date,
        items: items.map((item) => ({
          kind: item.kind,
          provider: item.provider || 'Unknown',
          startLocation: item.start_location,
          endLocation: item.end_location,
          startTs: item.start_ts,
          confirmationCode: item.confirmation_code,
        })),
        tripUrl: `${appUrl}/trips/${tripId}`,
      })
    )

    await resend.emails.send({
      from: 'UBTRIPPIN <trips@ubtrippin.xyz>',
      to: userEmail,
      subject: `Trip Updated: ${trip.title}`,
      html: emailHtml,
    })
  } catch (error) {
    console.error('Failed to send confirmation email:', error)
  }
}
