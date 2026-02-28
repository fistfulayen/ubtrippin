import { NextRequest, NextResponse } from 'next/server'
import { createSecretClient } from '@/lib/supabase/service'
import { verifyWebhookSignature, type ResendEmailPayload } from '@/lib/resend/verify-webhook'
import { getResendClient } from '@/lib/resend/client'
import { extractTravelData, type ExtractedItem } from '@/lib/ai/extract-travel-data'
import { extractTextFromPdf } from '@/lib/pdf/parse-attachment'
import {
  assignToTrip,
  updateTripDates,
  getPrimaryLocation,
  collectTravelerNames,
} from '@/lib/trips/assignment'
import { getDestinationImageUrl } from '@/lib/images/unsplash'
import { locationToCityAsync } from '@/lib/images/airport-cities'
import { generateTripName, isDefaultTitle } from '@/lib/trips/naming'
import { sanitizeHtml } from '@/lib/utils'
import { TripConfirmationEmail } from '@/components/email/trip-confirmation'
import { render } from '@react-email/components'
import { checkExtractionLimit, incrementExtractionCount } from '@/lib/usage/limits'
import { trackFirstForward, trackTripCreated } from '@/lib/activation'
import { applyEmailLoyaltyFlag } from '@/lib/loyalty-flag'
import { decryptLoyaltyNumber, encryptLoyaltyNumber, maskLoyaltyNumber } from '@/lib/loyalty-crypto'
import { resolveProviderKey } from '@/lib/loyalty-matching'

// Force dynamic rendering - webhooks must never be cached/static
export const dynamic = 'force-dynamic'

interface TripCandidate {
  id: string
  user_id: string
  title: string
  start_date: string | null
  end_date: string | null
  primary_location: string | null
  travelers: string[]
}

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

    // Route non-trips emails: forward hello@, privacy@, etc. to admin inbox
    const FORWARD_ADDRESSES: Record<string, string> = {
      'hello@ubtrippin.xyz': 'inspectorclouseau90@gmail.com',
      'privacy@ubtrippin.xyz': 'inspectorclouseau90@gmail.com',
      'support@ubtrippin.xyz': 'inspectorclouseau90@gmail.com',
      'security@ubtrippin.xyz': 'inspectorclouseau90@gmail.com',
    }

    // Check if this email should be forwarded instead of processed
    const toAddress = webhookData.to?.[0]?.toLowerCase() || ''
    if (FORWARD_ADDRESSES[toAddress]) {
      try {
        console.log(`Forwarding email to ${toAddress} → ${FORWARD_ADDRESSES[toAddress]}`)
        const resendForward = getResendClient()
        
        // Fetch the full email to forward it
        const { data: fwdEmail } = await resendForward.emails.receiving.get(webhookData.email_id)
        if (fwdEmail) {
          await resendForward.emails.send({
            from: `UBT Forwarded <trips@ubtrippin.xyz>`,
            to: FORWARD_ADDRESSES[toAddress],
            subject: `[${toAddress.split('@')[0]}@] ${fwdEmail.subject || '(no subject)'}`,
            text: `Forwarded from: ${fwdEmail.from}\nTo: ${toAddress}\n\n${fwdEmail.text || fwdEmail.html || '(no content)'}`,
          })
        }
        return NextResponse.json({ message: 'Email forwarded', to: toAddress })
      } catch (fwdError) {
        console.error('Failed to forward email:', fwdError)
        // Fall through to normal processing as backup
      }
    }

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
    const senderName =
      fullEmail.from.match(/^"?([^"<]+)"?\s*</)?.[1]?.trim() ||
      fromEmail.split('@')[0] ||
      null

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

    // ── Soft usage gate: check monthly extraction limit ───────────────────────
    const extractionCheck = await checkExtractionLimit(userId)
    if (!extractionCheck.allowed) {
      console.log(`Extraction limit reached for user ${userId}: ${extractionCheck.used}/${extractionCheck.limit}`)
      await supabase
        .from('source_emails')
        .update({
          parse_status: 'failed',
          parse_error: `Monthly extraction limit reached (${extractionCheck.used}/${extractionCheck.limit}). Upgrade to Pro for unlimited extractions.`,
        })
        .eq('id', sourceEmail.id)

      return NextResponse.json({
        message: 'Extraction limit reached',
        email_id: sourceEmail.id,
      })
    }
    // ─────────────────────────────────────────────────────────────────────────

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

      // Count this extraction against the user's monthly limit
      await incrementExtractionCount(userId)

      // Track that this user forwarded their first email (idempotent)
      trackFirstForward(userId).catch((err) =>
        console.error('[activation] trackFirstForward failed:', err)
      )

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
        const signupMatch = await detectLoyaltySignupEmail({
          supabase,
          subject: fullEmail.subject || '',
          body: `${fullEmail.text || ''}\n${fullEmail.html || ''}\n${attachmentText || ''}`,
          fallbackProviderDomain: fromEmail.split('@')[1] || '',
        })

        if (signupMatch?.provider_name && signupMatch.program_number) {
          const travelerName =
            signupMatch.traveler_name?.trim() ||
            userProfile?.full_name?.trim() ||
            'Traveler'

          await upsertLoyaltyFromSignup({
            supabase,
            userId,
            travelerName,
            providerType: signupMatch.provider_type,
            providerName: signupMatch.provider_name,
            providerKey: signupMatch.provider_key,
            programNumber: signupMatch.program_number,
          })

          await supabase
            .from('source_emails')
            .update({
              parse_status: 'completed',
              parse_error: null,
              extracted_json: {
                doc_type: 'loyalty_signup',
                items: [],
                loyalty_signup: {
                  provider_name: signupMatch.provider_name,
                  provider_key: signupMatch.provider_key,
                },
              },
            })
            .eq('id', sourceEmail.id)

          return NextResponse.json({
            message: 'Loyalty signup email processed',
            email_id: sourceEmail.id,
            items_created: 0,
          })
        }

        const recommendationImport = await importRecommendationEmail({
          supabase,
          userId,
          fromEmail,
          senderName,
          subject: fullEmail.subject || '',
          bodyText: `${fullEmail.text || ''}\n${attachmentText || ''}`,
        })

        if (recommendationImport.importedCount > 0) {
          await supabase
            .from('source_emails')
            .update({
              parse_status: 'completed',
              parse_error: null,
              extracted_json: {
                doc_type: 'guide_recommendations',
                items: [],
                recommendations_imported: recommendationImport.importedCount,
                city: recommendationImport.city,
              },
            })
            .eq('id', sourceEmail.id)

          return NextResponse.json({
            message: 'Recommendation email imported into guide entries',
            email_id: sourceEmail.id,
            items_created: 0,
            guide_entries_created: recommendationImport.importedCount,
          })
        }

        await sendUnclearEmailReply({
          to: fromEmail,
          name: userProfile?.full_name ?? null,
          resend,
        })

        return NextResponse.json({
          message: 'No travel items extracted',
          email_id: sourceEmail.id,
        })
      }

      // Get sender's existing trips for assignment
      const { data: existingTrips } = await supabase
        .from('trips')
        .select('id, user_id, title, start_date, end_date, primary_location, travelers')
        .eq('user_id', userId)

      // Also load family member trips for cross-family routing fallback.
      const familyTrips = await getFamilyTripCandidates(supabase, userId)

      const ownedTrips = (existingTrips ?? []) as TripCandidate[]
      const allTripCandidates = [...ownedTrips, ...familyTrips]
      const tripById = new Map(allTripCandidates.map((trip) => [trip.id, trip]))

      // Process extracted items - all items from same email go to same trip
      const createdItems: { tripId: string; itemId: string }[] = []
      const tripsToUpdate = new Map<string, { items: typeof extractionResult.items }>()

      // Determine trip assignment using the first item, then use same trip for all
      let emailTripId: string | null = null
      let emailTripOwnerId: string | null = null
      let familyTripMatch: TripCandidate | null | undefined = undefined

      for (const item of extractionResult.items) {
        let tripId: string | null = emailTripId
        let tripOwnerId: string | null = emailTripOwnerId

        // Only determine assignment for first item - all others go to same trip
        if (!tripId) {
          const assignment = assignToTrip(item, ownedTrips)
          tripId = assignment.tripId
          tripOwnerId = tripId ? userId : null

          // No own-trip match: try matching family-member trips before creating a new trip.
          if (!tripId) {
            if (familyTripMatch === undefined) {
              familyTripMatch = await findMatchingFamilyTrip(extractionResult.items, familyTrips)
            }
            if (familyTripMatch) {
              tripId = familyTripMatch.id
              tripOwnerId = familyTripMatch.user_id
            }
          }

          // Create new trip if needed
          if (!tripId) {
            // Use all items to determine best trip title and location
            const primaryLocation = getPrimaryLocation(extractionResult.items)
            const allTravelers = collectTravelerNames(extractionResult.items)

            // Convert airport codes to city names for better display (with AI fallback)
            const rawLocation = primaryLocation || item.end_location || item.start_location
            const cityLocation = rawLocation ? await locationToCityAsync(rawLocation) : null

            // Generate smart trip name using AI
            const smartTitle = await generateTripName(extractionResult.items, assignment.tripTitle)

            const { data: newTrip, error: tripError } = await supabase
              .from('trips')
              .insert({
                user_id: userId,
                title: smartTitle,
                start_date: item.start_date,
                end_date: item.end_date,
                primary_location: cityLocation,
                travelers: allTravelers.length > 0 ? allTravelers : (item.traveler_names || []),
              })
              .select()
              .single()

            if (tripError) {
              console.error('Failed to create trip:', tripError)
              continue
            }

            tripId = newTrip.id
            tripOwnerId = userId

            // Track activation milestone (idempotent)
            trackTripCreated(userId).catch((err) =>
              console.error('[activation] trackTripCreated failed:', err)
            )

            // Fetch and set cover image for the new trip
            const location = primaryLocation || item.end_location || item.start_location
            console.log('Fetching cover image for location:', location)
            if (location) {
              // Clean location for better Unsplash results - remove airport codes
              const cleanLocation = location
                .replace(/\s*\([A-Z]{3}\)\s*/g, ' ') // Remove (SFO) style codes
                .replace(/^[A-Z]{3}\s*[-–]\s*/, '') // Remove "SFO - " prefix
                .trim()

              console.log('Cleaned location:', cleanLocation)
              if (cleanLocation) {
                const coverImageUrl = await getDestinationImageUrl(cleanLocation)
                console.log('Cover image URL:', coverImageUrl)
                if (coverImageUrl) {
                  await supabase
                    .from('trips')
                    .update({ cover_image_url: coverImageUrl })
                    .eq('id', newTrip.id)
                }
              }
            }

            // Add to existing trips for future emails
            const insertedTrip: TripCandidate = {
              id: newTrip.id,
              user_id: userId,
              title: newTrip.title,
              start_date: newTrip.start_date,
              end_date: newTrip.end_date,
              primary_location: newTrip.primary_location,
              travelers: newTrip.travelers || [],
            }
            ownedTrips.push(insertedTrip)
            tripById.set(newTrip.id, insertedTrip)
          }

          // Remember this trip for all subsequent items from this email
          emailTripId = tripId
          emailTripOwnerId = tripOwnerId
        }

        // Track items per trip for date updates
        // tripId is guaranteed non-null here (created above if it was null)
        const confirmedTripId = tripId!
        const confirmedTripOwnerId = tripOwnerId || userId
        if (!tripsToUpdate.has(confirmedTripId)) {
          tripsToUpdate.set(confirmedTripId, { items: [] })
        }
        tripsToUpdate.get(confirmedTripId)!.items.push(item)

        // Create trip item
        const { data: tripItem, error: itemError } = await supabase
          .from('trip_items')
          .insert({
            user_id: confirmedTripOwnerId,
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

        await applyEmailLoyaltyFlag({
          userId: confirmedTripOwnerId,
          tripItemId: tripItem.id,
          providerName: item.provider,
          rawEmailText: `${fullEmail.subject || ''}\n${fullEmail.text || ''}\n${attachmentText || ''}`,
        })

        createdItems.push({ tripId: confirmedTripId, itemId: tripItem.id })
      }

      // Update trip dates and info for affected trips
      for (const [tripId, { items }] of tripsToUpdate) {
        const trip = tripById.get(tripId)
        if (!trip) continue

        const newDates = items.reduce(
          (dates, item) => updateTripDates(dates, item),
          { start_date: trip.start_date, end_date: trip.end_date }
        )

        const rawNewLocation = getPrimaryLocation(items) || trip.primary_location
        const newLocation = rawNewLocation ? await locationToCityAsync(rawNewLocation) : null
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

        // Build update object
        const tripUpdate: Record<string, unknown> = {
          start_date: newDates.start_date,
          end_date: newDates.end_date,
          primary_location: newLocation,
          travelers: mergedTravelers,
        }

        // Re-generate trip name whenever new items are added
        {
          const { data: allTripItems } = await supabase
            .from('trip_items')
            .select('kind, start_location, end_location, start_date, end_date, provider, summary, traveler_names')
            .eq('trip_id', tripId)

          if (allTripItems && allTripItems.length > 0) {
            const newTitle = await generateTripName(allTripItems, trip.title)
            if (newTitle) {
              tripUpdate.title = newTitle
            }
          }
        }

        await supabase
          .from('trips')
          .update(tripUpdate)
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

      // SECURITY: Do not echo raw error details back to webhook sender — internals stay server-side
      console.error('Processing error detail (not returned to caller):', error instanceof Error ? error.message : error)
      return NextResponse.json({
        message: 'Processing failed',
        email_id: sourceEmail.id,
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

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const FAMILY_TRIP_GAP_TOLERANCE_DAYS = 1

function toDateStartUtcMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`)
}

function rangesOverlapWithTolerance(
  startA: string | null,
  endA: string | null,
  startB: string | null,
  endB: string | null
): boolean {
  if (!startA || !startB) return false

  const toleranceMs = FAMILY_TRIP_GAP_TOLERANCE_DAYS * ONE_DAY_MS
  const aStart = toDateStartUtcMs(startA) - toleranceMs
  const aEnd = toDateStartUtcMs(endA || startA) + toleranceMs
  const bStart = toDateStartUtcMs(startB) - toleranceMs
  const bEnd = toDateStartUtcMs(endB || startB) + toleranceMs

  return aStart <= bEnd && aEnd >= bStart
}

function normalizeLocationForMatch(raw: string | null | undefined): string | null {
  if (!raw) return null

  const normalized = raw
    .toLowerCase()
    .replace(/\([a-z]{3}\)/g, ' ')
    .replace(/^[a-z]{3}\s*[-–]\s*/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

function normalizeTravelerName(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, ' ').trim()
}

function countSharedTravelers(emailTravelers: Set<string>, tripTravelers: string[]): number {
  let shared = 0
  for (const traveler of tripTravelers) {
    const normalized = normalizeTravelerName(traveler)
    if (normalized && emailTravelers.has(normalized)) {
      shared += 1
    }
  }
  return shared
}

async function findMatchingFamilyTrip(
  items: ExtractedItem[],
  familyTrips: TripCandidate[]
): Promise<TripCandidate | null> {
  if (items.length === 0 || familyTrips.length === 0) return null

  const emailTravelers = new Set(
    collectTravelerNames(items)
      .map((name) => normalizeTravelerName(name))
      .filter((name) => !!name)
  )
  if (emailTravelers.size === 0) return null

  const emailStartDate = items
    .map((item) => item.start_date)
    .sort()[0] || null
  const emailEndDate = items
    .map((item) => item.end_date || item.start_date)
    .sort()
    .slice(-1)[0] || emailStartDate

  const destinationTokens = new Set<string>()
  for (const item of items) {
    const rawLocation = item.end_location || item.start_location
    if (!rawLocation) continue

    const normalizedCity = await locationToCityAsync(rawLocation)
    const token = normalizeLocationForMatch(normalizedCity || rawLocation)
    if (token) destinationTokens.add(token)
  }
  if (destinationTokens.size === 0) return null

  let best: { trip: TripCandidate; shared: number; startDistance: number } | null = null

  for (const trip of familyTrips) {
    if (!rangesOverlapWithTolerance(emailStartDate, emailEndDate, trip.start_date, trip.end_date)) {
      continue
    }

    const tripLocationToken = normalizeLocationForMatch(trip.primary_location)
    if (!tripLocationToken || !destinationTokens.has(tripLocationToken)) {
      continue
    }

    const sharedTravelers = countSharedTravelers(emailTravelers, trip.travelers || [])
    if (sharedTravelers <= 0) continue

    const startDistance =
      emailStartDate && trip.start_date
        ? Math.abs(toDateStartUtcMs(emailStartDate) - toDateStartUtcMs(trip.start_date))
        : Number.MAX_SAFE_INTEGER

    if (
      !best ||
      sharedTravelers > best.shared ||
      (sharedTravelers === best.shared && startDistance < best.startDistance)
    ) {
      best = {
        trip,
        shared: sharedTravelers,
        startDistance,
      }
    }
  }

  return best?.trip ?? null
}

async function getFamilyTripCandidates(
  supabase: ReturnType<typeof createSecretClient>,
  userId: string
): Promise<TripCandidate[]> {
  const { data: userMembershipRows } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', userId)
    .not('accepted_at', 'is', null)

  const familyIds = Array.from(
    new Set(
      (userMembershipRows ?? [])
        .map((row) => (row as { family_id?: string }).family_id)
        .filter((familyId): familyId is string => typeof familyId === 'string' && familyId.length > 0)
    )
  )
  if (familyIds.length === 0) return []

  const { data: relatedMemberRows } = await supabase
    .from('family_members')
    .select('user_id')
    .in('family_id', familyIds)
    .not('accepted_at', 'is', null)
    .neq('user_id', userId)

  const relatedUserIds = Array.from(
    new Set(
      (relatedMemberRows ?? [])
        .map((row) => (row as { user_id?: string | null }).user_id)
        .filter((memberId): memberId is string => typeof memberId === 'string' && memberId.length > 0)
    )
  )
  if (relatedUserIds.length === 0) return []

  const { data: familyTripRows } = await supabase
    .from('trips')
    .select('id, user_id, title, start_date, end_date, primary_location, travelers')
    .in('user_id', relatedUserIds)

  return (familyTripRows ?? []) as TripCandidate[]
}

interface LoyaltySignupMatch {
  provider_name: string
  provider_key: string
  provider_type: 'airline' | 'hotel' | 'car_rental' | 'other'
  program_number: string
  traveler_name: string | null
}

function extractLoyaltyProgramNumber(input: string): string | null {
  const focusedPatterns = [
    /(?:membership|member|loyalty|frequent flyer|rewards|program)\s*(?:number|#|id)?\s*[:#-]?\s*([A-Z0-9]{6,20})/i,
    /your\s+[a-z\s]{0,20}number\s+is\s+([A-Z0-9]{6,20})/i,
    /number:\s*([A-Z0-9]{6,20})/i,
  ]

  for (const pattern of focusedPatterns) {
    const match = input.match(pattern)
    if (match?.[1]) return match[1].toUpperCase()
  }

  return null
}

function looksLikeLoyaltySignup(subject: string, body: string): boolean {
  const subjectPatterns = [
    /welcome to/i,
    /enrollment confirmation/i,
    /membership confirmation/i,
    /your .* number/i,
    /you('| a)?re enrolled/i,
  ]

  const bodySignals = /(membership|member number|frequent flyer|loyalty|rewards program)/i
  return subjectPatterns.some((pattern) => pattern.test(subject)) || bodySignals.test(body)
}

async function detectLoyaltySignupEmail(params: {
  supabase: ReturnType<typeof createSecretClient>
  subject: string
  body: string
  fallbackProviderDomain: string
}): Promise<LoyaltySignupMatch | null> {
  if (!looksLikeLoyaltySignup(params.subject, params.body)) return null

  const programNumber = extractLoyaltyProgramNumber(`${params.subject}\n${params.body}`)
  if (!programNumber) return null

  const { data: providers } = await params.supabase
    .from('provider_catalog')
    .select('provider_key, provider_name, provider_type')

  const providerRows = (providers ?? []) as Array<{
    provider_key: string
    provider_name: string
    provider_type: 'airline' | 'hotel' | 'car_rental' | 'other'
  }>

  const haystack = `${params.subject}\n${params.body}`.toLowerCase()
  const directMatch = providerRows.find((provider) =>
    haystack.includes(provider.provider_name.toLowerCase())
  )

  if (directMatch) {
    return {
      provider_name: directMatch.provider_name,
      provider_key: directMatch.provider_key,
      provider_type: directMatch.provider_type,
      program_number: programNumber,
      traveler_name: null,
    }
  }

  const domainHint = params.fallbackProviderDomain.split('.')[0] || ''
  const resolvedProviderKey = resolveProviderKey(domainHint)
  if (!resolvedProviderKey) return null

  const fallback = providerRows.find((provider) => provider.provider_key === resolvedProviderKey)
  if (!fallback) return null

  return {
    provider_name: fallback.provider_name,
    provider_key: fallback.provider_key,
    provider_type: fallback.provider_type,
    program_number: programNumber,
    traveler_name: null,
  }
}

async function upsertLoyaltyFromSignup(params: {
  supabase: ReturnType<typeof createSecretClient>
  userId: string
  travelerName: string
  providerType: 'airline' | 'hotel' | 'car_rental' | 'other'
  providerName: string
  providerKey: string
  programNumber: string
}) {
  const normalizedNumber = params.programNumber.trim()
  if (!normalizedNumber) return

  const { data: existing } = await params.supabase
    .from('loyalty_programs')
    .select('id, program_number_encrypted')
    .eq('user_id', params.userId)
    .eq('provider_key', params.providerKey)

  for (const row of existing ?? []) {
    const record = row as { id: string; program_number_encrypted: string }
    if (decryptLoyaltyNumber(record.program_number_encrypted).trim().toUpperCase() === normalizedNumber.toUpperCase()) {
      return
    }
  }

  const { count } = await params.supabase
    .from('loyalty_programs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', params.userId)

  const { data: profile } = await params.supabase
    .from('profiles')
    .select('tier, subscription_tier')
    .eq('id', params.userId)
    .maybeSingle()

  const plan = profile as { tier?: string | null; subscription_tier?: string | null } | null
  const isPro = plan?.tier === 'pro' || plan?.subscription_tier === 'pro'
  if (!isPro && (count ?? 0) >= 3) return

  await params.supabase
    .from('loyalty_programs')
    .insert({
      user_id: params.userId,
      traveler_name: params.travelerName,
      provider_type: params.providerType,
      provider_name: params.providerName,
      provider_key: params.providerKey,
      program_number_encrypted: encryptLoyaltyNumber(normalizedNumber),
      program_number_masked: maskLoyaltyNumber(normalizedNumber),
      preferred: false,
    })
}

interface RecommendationImportResult {
  importedCount: number
  city: string | null
}

function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function looksLikeBookingEmail(subject: string, bodyText: string): boolean {
  const haystack = normalizeText(`${subject}\n${bodyText}`)
  const bookingSignals = [
    'booking confirmation',
    'reservation confirmed',
    'itinerary',
    'ticket number',
    'check-in',
    'boarding pass',
    'flight',
    'hotel',
    'confirmation code',
    'pnr',
  ]
  return bookingSignals.some((signal) => haystack.includes(signal))
}

function looksLikeRecommendationEmail(subject: string, bodyText: string): boolean {
  const haystack = normalizeText(`${subject}\n${bodyText}`)
  const recommendationSignals = [
    'recommend',
    'recommendation',
    'places to eat',
    'places to visit',
    'you should try',
    'you should go',
    'my list',
    'favorites in',
    'must-try',
    'must visit',
  ]
  const hasRecommendationSignal = recommendationSignals.some((signal) => haystack.includes(signal))
  return hasRecommendationSignal && !looksLikeBookingEmail(subject, bodyText)
}

function cleanRecommendationLine(line: string): string {
  return line
    .replace(/^[\-\*\u2022]+\s*/, '')
    .replace(/^\d+[\.\)]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function inferCategoryFromLine(line: string): string {
  const lower = normalizeText(line)
  if (/(coffee|cafe|espresso|roaster)/u.test(lower)) return 'Coffee'
  if (/(bar|wine|cocktail|brewery|pub)/u.test(lower)) return 'Bars & Wine'
  if (/(museum|gallery|exhibit|exhibition)/u.test(lower)) return 'Museums & Galleries'
  if (/(park|garden|hike|trail|nature)/u.test(lower)) return 'Parks & Nature'
  if (/(restaurant|dinner|lunch|brunch|food|eat)/u.test(lower)) return 'Restaurants'
  return 'Hidden Gems'
}

function extractRecommendationCandidates(bodyText: string): Array<{ name: string; description: string | null; category: string }> {
  const lines = bodyText
    .split('\n')
    .map((line) => cleanRecommendationLine(line))
    .filter((line) => line.length >= 3 && line.length <= 180)

  const seen = new Set<string>()
  const results: Array<{ name: string; description: string | null; category: string }> = []

  for (const line of lines) {
    const bulletLike = /^([\p{Lu}0-9][\p{L}0-9 '&().,-]{2,80})(\s*[-\u2013:]\s*(.+))?$/u.exec(line)
    if (!bulletLike) continue

    const name = bulletLike[1].trim()
    if (name.split(' ').length > 8) continue
    const normalized = normalizeText(name)
    if (seen.has(normalized)) continue
    seen.add(normalized)

    const description = bulletLike[3]?.trim() || null
    const category = inferCategoryFromLine(line)
    results.push({ name, description, category })

    if (results.length >= 10) break
  }

  return results
}

function inferRecommendationCity(subject: string, bodyText: string): string | null {
  const normalizedSubject = normalizeText(subject)
  const normalizedBody = normalizeText(bodyText)

  const subjectMatch = normalizedSubject.match(/\b(?:in|for|around)\s+([a-z][a-z' -]+(?:\s+[a-z][a-z' -]+){0,2})\b/)
  if (subjectMatch?.[1]) return subjectMatch[1].trim()

  const bodyMatch = normalizedBody.match(/\b(?:in|for|around)\s+([a-z][a-z' -]+(?:\s+[a-z][a-z' -]+){0,2})\b/)
  if (bodyMatch?.[1]) return bodyMatch[1].trim()

  const cityListMatch = normalizedSubject.match(/^([a-z][a-z' -]+(?:\s+[a-z][a-z' -]+){0,2})\s+(?:recommendations|recs|favorites)\b/)
  if (cityListMatch?.[1]) return cityListMatch[1].trim()

  return null
}

async function importRecommendationEmail(params: {
  supabase: ReturnType<typeof createSecretClient>
  userId: string
  fromEmail: string
  senderName: string | null
  subject: string
  bodyText: string
}): Promise<RecommendationImportResult> {
  if (!looksLikeRecommendationEmail(params.subject, params.bodyText)) {
    return { importedCount: 0, city: null }
  }

  const candidates = extractRecommendationCandidates(params.bodyText)
  if (candidates.length === 0) {
    return { importedCount: 0, city: null }
  }

  let city = inferRecommendationCity(params.subject, params.bodyText)
  if (!city) {
    const { data: guides } = await params.supabase
      .from('city_guides')
      .select('city')
      .eq('user_id', params.userId)
      .limit(2)

    if (guides && guides.length === 1) {
      city = (guides[0] as { city: string }).city
    }
  }

  if (!city) return { importedCount: 0, city: null }

  const { data: existingGuide } = await params.supabase
    .from('city_guides')
    .select('id')
    .eq('user_id', params.userId)
    .ilike('city', city)
    .maybeSingle()

  let guideId = existingGuide?.id ?? null
  if (!guideId) {
    const { data: newGuide } = await params.supabase
      .from('city_guides')
      .insert({ user_id: params.userId, city })
      .select('id')
      .single()
    guideId = newGuide?.id ?? null
  }

  if (!guideId) return { importedCount: 0, city }

  const { data: authorProfile } = await params.supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', params.userId)
    .maybeSingle()
  const profile = authorProfile as { full_name?: string | null; email?: string | null } | null
  const authorName = profile?.full_name || profile?.email || null

  const inserts = candidates.map((candidate) => ({
    guide_id: guideId,
    user_id: params.userId,
    author_id: params.userId,
    author_name: authorName,
    name: candidate.name,
    category: candidate.category,
    status: 'to_try' as const,
    description: candidate.description,
    recommended_by: params.senderName || params.fromEmail,
    source: 'import' as const,
  }))

  const { error } = await params.supabase.from('guide_entries').insert(inserts)
  if (error) {
    console.error('[webhooks/resend] Failed to import recommendation entries:', error)
    return { importedCount: 0, city }
  }

  return { importedCount: inserts.length, city }
}

async function sendUnclearEmailReply(params: {
  to: string
  name: string | null
  resend: ReturnType<typeof getResendClient>
}) {
  const displayName = params.name?.trim() || 'there'
  await params.resend.emails.send({
    from: 'UBTRIPPIN <trips@ubtrippin.xyz>',
    to: params.to,
    subject: "We couldn't process your forwarded email",
    text: `Hi ${displayName}, we received your email but couldn't figure out what to do with it. If you were trying to add a booking, try forwarding the confirmation email from the airline/hotel/car rental. If you were trying to add a loyalty program, forward your membership welcome email.`,
  })
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
