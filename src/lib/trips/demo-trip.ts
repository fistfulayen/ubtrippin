import { createClient } from '@/lib/supabase/server'

interface CreateDemoTripParams {
  userId: string
  travelerName?: string | null
  signupAt?: string | null
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function normalizeTravelerName(name?: string | null): string {
  const trimmed = (name ?? '').trim()
  return trimmed.length > 0 ? trimmed : 'Traveler'
}

export async function createDemoTrip(
  { userId, travelerName, signupAt }: CreateDemoTripParams
): Promise<string | null> {
  const supabase = await createClient()

  const { count, error: countError } = await supabase
    .from('trips')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (countError) throw countError
  if ((count ?? 0) > 0) return null

  const baseDate = signupAt ? new Date(signupAt) : new Date()
  const departureDate = addDays(baseDate, 7)
  const arrivalDate = addDays(departureDate, 1)
  const checkoutDate = addDays(arrivalDate, 5)

  const departureDateStr = toDateString(departureDate)
  const arrivalDateStr = toDateString(arrivalDate)
  const checkoutDateStr = toDateString(checkoutDate)
  const traveler = normalizeTravelerName(travelerName)

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .insert({
      user_id: userId,
      title: 'Chicago → Tokyo',
      start_date: departureDateStr,
      end_date: checkoutDateStr,
      primary_location: 'Tokyo, Japan',
      travelers: [traveler],
      notes: 'Sample Trip — forward a booking email to trips@ubtrippin.xyz to create your own!',
      is_demo: true,
    })
    .select('id')
    .single()

  if (tripError) throw tripError

  const { error: itemsError } = await supabase
    .from('trip_items')
    .insert([
      {
        user_id: userId,
        trip_id: trip.id,
        kind: 'flight',
        provider: 'ANA',
        confirmation_code: 'SAMPLE1',
        traveler_names: [traveler],
        start_date: departureDateStr,
        end_date: arrivalDateStr,
        start_ts: `${departureDateStr}T11:25:00-05:00`,
        end_ts: `${arrivalDateStr}T14:20:00+09:00`,
        start_location: 'Chicago O\'Hare (ORD)',
        end_location: 'Tokyo Narita (NRT)',
        summary: 'ANA NH11 · Chicago (ORD) to Tokyo (NRT)',
        details_json: {
          flight_number: 'NH11',
          departure_airport: 'ORD',
          arrival_airport: 'NRT',
          departure_local_time: '11:25',
          arrival_local_time: '14:20',
          departure_terminal: 'Terminal 1',
          arrival_terminal: 'Terminal 1',
        },
        status: 'confirmed',
        confidence: 1,
        needs_review: false,
      },
      {
        user_id: userId,
        trip_id: trip.id,
        kind: 'hotel',
        provider: 'Grand Hyatt Tokyo',
        confirmation_code: 'GHYTOKYO',
        traveler_names: [traveler],
        start_date: arrivalDateStr,
        end_date: checkoutDateStr,
        start_ts: `${arrivalDateStr}T15:00:00+09:00`,
        end_ts: `${checkoutDateStr}T11:00:00+09:00`,
        start_location: '6-10-3 Roppongi, Minato-ku, Tokyo 106-0032, Japan',
        end_location: null,
        summary: 'Grand Hyatt Tokyo · 5-night stay',
        details_json: {
          hotel_name: 'Grand Hyatt Tokyo',
          address: '6-10-3 Roppongi, Minato-ku, Tokyo 106-0032, Japan',
          check_in_time: '15:00',
          check_out_time: '11:00',
          nights: 5,
        },
        status: 'confirmed',
        confidence: 1,
        needs_review: false,
      },
      {
        user_id: userId,
        trip_id: trip.id,
        kind: 'flight',
        provider: 'ANA',
        confirmation_code: 'SAMPLE1',
        traveler_names: [traveler],
        start_date: checkoutDateStr,
        end_date: checkoutDateStr,
        start_ts: `${checkoutDateStr}T17:05:00+09:00`,
        end_ts: `${checkoutDateStr}T15:00:00-05:00`,
        start_location: 'Tokyo Narita (NRT)',
        end_location: 'Chicago O\'Hare (ORD)',
        summary: 'ANA NH12 · Tokyo (NRT) to Chicago (ORD)',
        details_json: {
          flight_number: 'NH12',
          departure_airport: 'NRT',
          arrival_airport: 'ORD',
          departure_local_time: '17:05',
          arrival_local_time: '15:00',
          departure_terminal: 'Terminal 1',
          arrival_terminal: 'Terminal 1',
        },
        status: 'confirmed',
        confidence: 1,
        needs_review: false,
      },
    ])

  if (itemsError) {
    throw itemsError
  }

  return trip.id
}
