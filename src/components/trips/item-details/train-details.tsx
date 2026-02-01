import { TrainFront, Armchair } from 'lucide-react'
import type { TrainDetails } from '@/types/database'

interface TrainDetailsViewProps {
  details: TrainDetails
}

export function TrainDetailsView({ details }: TrainDetailsViewProps) {
  const {
    train_number,
    operator,
    departure_station,
    arrival_station,
    carriage,
    seat,
    booking_reference,
  } = details

  const trainCode = train_number
    ? operator
      ? `${operator} ${train_number}`
      : train_number
    : operator || null

  const seatInfo = [carriage ? `Car ${carriage}` : null, seat ? `Seat ${seat}` : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-green-50 to-gray-100 p-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        {trainCode && (
          <span className="font-mono text-lg font-bold text-gray-900">{trainCode}</span>
        )}
        {seatInfo && (
          <span className="flex items-center gap-1 rounded bg-green-100 px-2 py-0.5 text-sm font-medium text-green-700">
            <Armchair className="h-3.5 w-3.5" />
            {seatInfo}
          </span>
        )}
      </div>

      {/* Train route visualization */}
      {(departure_station || arrival_station) && (
        <div className="mt-4 flex items-center justify-between gap-4">
          {/* Departure */}
          <div className="flex-1">
            {departure_station && (
              <div className="text-lg font-semibold text-gray-900">{departure_station}</div>
            )}
          </div>

          {/* Train line */}
          <div className="flex flex-1 items-center justify-center">
            <div className="h-px flex-1 bg-gray-300" />
            <TrainFront className="mx-2 h-5 w-5 text-green-500" />
            <div className="h-px flex-1 bg-gray-300" />
          </div>

          {/* Arrival */}
          <div className="flex-1 text-right">
            {arrival_station && (
              <div className="text-lg font-semibold text-gray-900">{arrival_station}</div>
            )}
          </div>
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
