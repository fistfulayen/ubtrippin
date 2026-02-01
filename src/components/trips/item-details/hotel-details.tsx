import { MapPin, Clock, BedDouble, Phone } from 'lucide-react'
import type { HotelDetails } from '@/types/database'

interface HotelDetailsViewProps {
  details: HotelDetails
}

export function HotelDetailsView({ details }: HotelDetailsViewProps) {
  const {
    hotel_name,
    address,
    room_type,
    check_in_time,
    check_out_time,
    booking_reference,
    contact_phone,
  } = details

  return (
    <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-purple-50 to-gray-100 p-4">
      {/* Hotel name if provided separately */}
      {hotel_name && (
        <div className="mb-3 text-lg font-semibold text-gray-900">{hotel_name}</div>
      )}

      {/* Address */}
      {address && (
        <div className="flex items-start gap-2 text-sm text-gray-600">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-purple-500" />
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-purple-700 hover:underline"
          >
            {address}
          </a>
        </div>
      )}

      {/* Check-in/out times */}
      {(check_in_time || check_out_time) && (
        <div className="mt-4 grid grid-cols-2 gap-4">
          {check_in_time && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Check-in
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-lg font-semibold text-gray-900">
                <Clock className="h-4 w-4 text-green-500" />
                {check_in_time}
              </div>
            </div>
          )}
          {check_out_time && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Check-out
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-lg font-semibold text-gray-900">
                <Clock className="h-4 w-4 text-red-500" />
                {check_out_time}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Room type */}
      {room_type && (
        <div className="mt-4 flex items-center gap-2">
          <BedDouble className="h-4 w-4 text-purple-500" />
          <span className="rounded bg-purple-100 px-2 py-0.5 text-sm font-medium text-purple-700">
            {room_type}
          </span>
        </div>
      )}

      {/* Contact phone */}
      {contact_phone && (
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
          <Phone className="h-4 w-4 text-gray-400" />
          <a href={`tel:${contact_phone}`} className="hover:text-purple-700">
            {contact_phone}
          </a>
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
