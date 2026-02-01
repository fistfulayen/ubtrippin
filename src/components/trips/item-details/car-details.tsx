import { Car, MapPin, ArrowRight } from 'lucide-react'
import type { CarRentalDetails } from '@/types/database'

interface CarDetailsViewProps {
  details: CarRentalDetails
}

export function CarDetailsView({ details }: CarDetailsViewProps) {
  const { rental_company, pickup_location, dropoff_location, vehicle_type, booking_reference } =
    details

  const sameLocation = pickup_location && dropoff_location && pickup_location === dropoff_location

  return (
    <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-orange-50 to-gray-100 p-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        {rental_company && (
          <span className="text-lg font-bold text-gray-900">{rental_company}</span>
        )}
        {vehicle_type && (
          <span className="flex items-center gap-1 rounded bg-orange-100 px-2 py-0.5 text-sm font-medium text-orange-700">
            <Car className="h-3.5 w-3.5" />
            {vehicle_type}
          </span>
        )}
      </div>

      {/* Pickup/Dropoff locations */}
      {(pickup_location || dropoff_location) && (
        <div className="mt-4 space-y-3">
          {pickup_location && (
            <div className="flex items-start gap-2">
              <div className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
                PICKUP
              </div>
              <div className="flex items-center gap-1 text-sm text-gray-700">
                <MapPin className="h-4 w-4 text-green-500" />
                {pickup_location}
              </div>
            </div>
          )}

          {dropoff_location && !sameLocation && (
            <div className="flex items-start gap-2">
              <div className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                DROP-OFF
              </div>
              <div className="flex items-center gap-1 text-sm text-gray-700">
                <MapPin className="h-4 w-4 text-red-500" />
                {dropoff_location}
              </div>
            </div>
          )}

          {sameLocation && (
            <div className="text-xs text-gray-500">Return to same location</div>
          )}
        </div>
      )}

      {/* Booking reference */}
      {booking_reference && (
        <div className="mt-4 border-t border-dashed border-gray-300 pt-3">
          <span className="text-xs text-gray-500">Booking Reference</span>
          <span className="ml-2 font-mono font-medium text-gray-900">{booking_reference}</span>
        </div>
      )}
    </div>
  )
}
