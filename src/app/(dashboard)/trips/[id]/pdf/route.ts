import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { ItineraryDocument } from '@/components/pdf/itinerary-document'
import { isValidUUID } from '@/lib/validation'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // SECURITY: Validate route param is a well-formed UUID
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 })
  }

  const supabase = await createClient()

  // Verify user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get trip
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (tripError || !trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }

  // Get trip items
  const { data: items } = await supabase
    .from('trip_items')
    .select('*')
    .eq('trip_id', id)
    .order('start_date', { ascending: true })
    .order('start_ts', { ascending: true })

  // Generate PDF
  const pdfBuffer = await renderToBuffer(
    ItineraryDocument({ trip, items: items || [] })
  )

  // Create filename
  const sanitizedTitle = trip.title
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50)
  const filename = `${sanitizedTitle}_itinerary.pdf`

  // Convert Buffer to Uint8Array for NextResponse
  const uint8Array = new Uint8Array(pdfBuffer)

  return new NextResponse(uint8Array, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
