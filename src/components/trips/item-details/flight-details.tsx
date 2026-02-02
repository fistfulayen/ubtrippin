'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Plane, MapPin, Clock, Armchair } from 'lucide-react'
import type { FlightDetails } from '@/types/database'
import { getAirlineLogoUrl } from '@/lib/images/airline-logo'

interface FlightDetailsViewProps {
  details: FlightDetails
}

export function FlightDetailsView({ details }: FlightDetailsViewProps) {
  const [logoError, setLogoError] = useState(false)

  const {
    flight_number,
    airline,
    departure_airport,
    arrival_airport,
    departure_terminal,
    arrival_terminal,
    departure_gate,
    arrival_gate,
    cabin_class,
    seat,
  } = details

  const flightCode = flight_number
    ? airline
      ? `${airline} ${flight_number}`
      : flight_number
    : null

  const seatInfo = [cabin_class, seat].filter(Boolean).join(' · ')
  const logoUrl = airline ? getAirlineLogoUrl(airline) : null

  // Debug logging
  if (typeof window !== 'undefined') {
    console.log('Flight details - airline:', airline, 'logoUrl:', logoUrl)
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-slate-50 to-gray-100 p-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {logoUrl && !logoError && (
            <Image
              src={logoUrl}
              alt={airline || 'Airline'}
              width={32}
              height={32}
              className="rounded"
              onError={() => setLogoError(true)}
            />
          )}
          {flightCode && (
            <span className="font-mono text-lg font-bold text-gray-900">{flightCode}</span>
          )}
        </div>
        {seatInfo && (
          <span className="flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-sm font-medium text-blue-700">
            <Armchair className="h-3.5 w-3.5" />
            {seatInfo}
          </span>
        )}
      </div>

      {/* Flight route visualization */}
      {(departure_airport || arrival_airport) && (
        <div className="mt-4 flex items-center justify-between gap-4">
          {/* Departure */}
          <div className="flex-1 text-center">
            {departure_airport && (
              <div className="text-2xl font-bold text-gray-900">{departure_airport}</div>
            )}
            {departure_terminal && (
              <div className="mt-1 text-xs text-gray-500">Terminal {departure_terminal}</div>
            )}
            {departure_gate && (
              <div className="mt-0.5 text-xs font-medium text-blue-600">Gate {departure_gate}</div>
            )}
          </div>

          {/* Flight line */}
          <div className="flex flex-1 items-center justify-center">
            <div className="h-px flex-1 bg-gray-300" />
            <Plane className="mx-2 h-5 w-5 text-blue-500" />
            <div className="h-px flex-1 bg-gray-300" />
          </div>

          {/* Arrival */}
          <div className="flex-1 text-center">
            {arrival_airport && (
              <div className="text-2xl font-bold text-gray-900">{arrival_airport}</div>
            )}
            {arrival_terminal && (
              <div className="mt-1 text-xs text-gray-500">Terminal {arrival_terminal}</div>
            )}
            {arrival_gate && (
              <div className="mt-0.5 text-xs font-medium text-blue-600">Gate {arrival_gate}</div>
            )}
          </div>
        </div>
      )}

      {/* Booking reference */}
      {details.booking_reference && (
        <div className="mt-4 border-t border-dashed border-gray-300 pt-3">
          <span className="text-xs text-gray-500">Booking Reference</span>
          <span className="ml-2 font-mono font-medium text-gray-900">
            {details.booking_reference}
          </span>
        </div>
      )}
    </div>
  )
}
