import { Plane } from 'lucide-react'

interface FlightPageHeaderProps {
  airline: string | null
  ident: string
  originCity: string | null
  destinationCity: string | null
  date: string
  aircraftType: string | null
}

export function FlightPageHeader({
  airline,
  ident,
  originCity,
  destinationCity,
  date,
  aircraftType,
}: FlightPageHeaderProps) {
  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-2 text-slate-500 text-sm mb-2">
        <Plane className="h-4 w-4" />
        <span>Live Flight Status</span>
      </div>
      
      {airline && (
        <p className="text-slate-600 text-lg mb-1">{airline}</p>
      )}
      
      <h1 className="text-4xl font-bold text-slate-900 mb-2">{ident}</h1>
      
      <p className="text-xl text-slate-700 mb-1">
        {originCity ?? 'Origin'} → {destinationCity ?? 'Destination'}
      </p>
      
      <p className="text-slate-500">{formattedDate}</p>
      
      {aircraftType && (
        <p className="text-slate-400 text-sm mt-1">Aircraft: {aircraftType}</p>
      )}
    </div>
  )
}
