import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { FlightPageHeader } from '@/components/flights/flight-page-header'
import { FlightStatusBlock } from '@/components/flights/flight-status-block'
import { FlightProgressBar } from '@/components/flights/flight-progress-bar'
import { FlightPageCta } from '@/components/flights/flight-page-cta'
import { FlightRefreshButtonClient } from '@/components/flights/flight-refresh-button-client'

interface FlightPageProps {
  params: Promise<{ ident: string; date: string }>
}

interface FlightData {
  flight: {
    ident: string
    airline: string | null
    origin: {
      code: string
      city: string | null
      name: string | null
      gate: string | null
      terminal: string | null
      timezone: string | null
    }
    destination: {
      code: string
      city: string | null
      name: string | null
      gate: string | null
      terminal: string | null
      timezone: string | null
    }
    scheduled_departure: string | null
    estimated_departure: string | null
    actual_departure: string | null
    scheduled_arrival: string | null
    estimated_arrival: string | null
    actual_arrival: string | null
    status: string
    delay_minutes: number | null
    aircraft_type: string | null
    progress_percent: number | null
  }
  cached: boolean
  last_updated: string
}

async function fetchFlightData(ident: string, date: string): Promise<FlightData | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const response = await fetch(
      `${baseUrl}/api/v1/flights/${ident}/${date}/live`,
      { next: { revalidate: 0 } }
    )
    
    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error(`Failed to fetch flight data: ${response.status}`)
    }
    
    return response.json()
  } catch (error) {
    console.error('Error fetching flight data:', error)
    return null
  }
}

export async function generateMetadata({ params }: FlightPageProps): Promise<Metadata> {
  const { ident, date } = await params
  const data = await fetchFlightData(ident.toUpperCase(), date)
  
  if (!data) {
    return {
      title: 'Flight Not Found | UB Trippin',
    }
  }
  
  const { flight } = data
  const originCity = flight.origin.city ?? flight.origin.code
  const destCity = flight.destination.city ?? flight.destination.code
  
  return {
    title: `${flight.ident} Flight Status — ${flight.airline ?? 'Airline'} ${originCity} to ${destCity} | UB Trippin`,
    description: `Live flight status for ${flight.airline ?? 'flight'} ${flight.ident} from ${originCity} to ${destCity}. Real-time gate, delay, and arrival updates.`,
    openGraph: {
      title: `${flight.ident} Flight Status | UB Trippin`,
      description: `Track ${flight.ident} from ${originCity} to ${destCity}. ${flight.status.replace('_', ' ')}.`,
    },
  }
}

export default async function FlightPage({ params }: FlightPageProps) {
  const { ident: rawIdent, date } = await params
  const ident = rawIdent.toUpperCase()
  
  const data = await fetchFlightData(ident, date)
  
  if (!data) {
    notFound()
  }
  
  const { flight, last_updated } = data

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <FlightPageHeader
          airline={flight.airline}
          ident={flight.ident}
          originCity={flight.origin.city}
          destinationCity={flight.destination.city}
          date={date}
        />
        
        <div className="mt-8 space-y-6">
          {/* Status block */}
          <FlightStatusBlock
            status={flight.status}
            delayMinutes={flight.delay_minutes}
            origin={flight.origin}
            destination={flight.destination}
            scheduledDeparture={flight.scheduled_departure}
            estimatedDeparture={flight.estimated_departure}
            actualDeparture={flight.actual_departure}
            scheduledArrival={flight.scheduled_arrival}
            estimatedArrival={flight.estimated_arrival}
            actualArrival={flight.actual_arrival}
          />
          
          {/* Progress bar */}
          <FlightProgressBar
            originCode={flight.origin.code}
            destinationCode={flight.destination.code}
            progressPercent={flight.progress_percent}
            status={flight.status}
          />
          
          {/* Refresh button */}
          <div className="flex justify-center">
            <FlightRefreshButtonClient
              ident={ident}
              date={date}
              lastUpdated={last_updated}
            />
          </div>
          
          {/* CTA */}
          <FlightPageCta />
        </div>
      </div>
    </main>
  )
}
