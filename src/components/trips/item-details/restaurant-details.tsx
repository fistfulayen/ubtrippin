import { Clock, MapPin, Users, Utensils, Armchair, Phone } from 'lucide-react'
import type { RestaurantDetails } from '@/types/database'
import { formatLocalTime } from '@/lib/utils'

interface RestaurantDetailsViewProps {
  details: RestaurantDetails
}

export function RestaurantDetailsView({ details }: RestaurantDetailsViewProps) {
  const {
    restaurant_name,
    address,
    reservation_time,
    party_size,
    seating,
    purpose,
    contact_phone,
    booking_reference,
  } = details

  return (
    <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-rose-50 to-gray-100 p-4">
      {restaurant_name && (
        <div className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-900">
          <Utensils className="h-4 w-4 text-rose-500" />
          {restaurant_name}
        </div>
      )}

      {address && (
        <div className="flex items-start gap-2 text-sm text-gray-600">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-rose-700 hover:underline"
          >
            {address}
          </a>
        </div>
      )}

      {(reservation_time || party_size) && (
        <div className="mt-4 grid grid-cols-2 gap-4">
          {reservation_time && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Reservation
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-lg font-semibold text-gray-900">
                <Clock className="h-4 w-4 text-rose-500" />
                {formatLocalTime(reservation_time)}
              </div>
            </div>
          )}
          {party_size && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Party Size
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-lg font-semibold text-gray-900">
                <Users className="h-4 w-4 text-rose-500" />
                {party_size} {party_size === 1 ? 'guest' : 'guests'}
              </div>
            </div>
          )}
        </div>
      )}

      {(seating || purpose) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {seating && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-sm font-medium text-rose-700">
              <Armchair className="h-3.5 w-3.5" />
              {seating}
            </span>
          )}
          {purpose && (
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-sm font-medium text-gray-700">
              {purpose}
            </span>
          )}
        </div>
      )}

      {contact_phone && (
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
          <Phone className="h-4 w-4 text-gray-400" />
          <a href={`tel:${contact_phone}`} className="hover:text-rose-700">
            {contact_phone}
          </a>
        </div>
      )}

      {booking_reference && (
        <div className="mt-4 border-t border-dashed border-gray-300 pt-3">
          <span className="text-xs text-gray-500">Confirmation</span>
          <span className="ml-2 font-mono font-medium text-gray-900">{booking_reference}</span>
        </div>
      )}
    </div>
  )
}
