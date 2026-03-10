import { cn } from '@/lib/utils'

const STATUS_META: Record<string, { label: string; toneClass: string; message: string }> = {
  on_time: { 
    label: 'On time', 
    toneClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    message: 'Right on schedule. ☕'
  },
  delayed: { 
    label: 'Delayed', 
    toneClass: 'text-amber-700 bg-amber-50 border-amber-200',
    message: 'Time moves slowly in airports.'
  },
  cancelled: { 
    label: 'Cancelled', 
    toneClass: 'text-red-700 bg-red-50 border-red-200',
    message: 'We\'re sorry.'
  },
  diverted: { 
    label: 'Diverted', 
    toneClass: 'text-red-700 bg-red-50 border-red-200',
    message: 'Flight diverted.'
  },
  en_route: { 
    label: 'En route', 
    toneClass: 'text-blue-700 bg-blue-50 border-blue-200',
    message: 'Somewhere over the sky.'
  },
  boarding: { 
    label: 'Boarding', 
    toneClass: 'text-blue-700 bg-blue-50 border-blue-200',
    message: 'Boarding now. Phone in airplane mode soon.'
  },
  landed: { 
    label: 'Landed', 
    toneClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    message: 'Wheels down. Welcome.'
  },
  arrived: { 
    label: 'Arrived', 
    toneClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    message: 'Welcome.'
  },
  unknown: { 
    label: 'Status unknown', 
    toneClass: 'text-gray-700 bg-gray-50 border-gray-200',
    message: 'Checking with the airline...'
  },
}

interface FlightStatusBlockProps {
  status: string
  delayMinutes: number | null
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
  scheduledDeparture: string | null
  estimatedDeparture: string | null
  actualDeparture: string | null
  scheduledArrival: string | null
  estimatedArrival: string | null
  actualArrival: string | null
}

function formatTimeInZone(isoString: string | null, timezone: string | null): string | null {
  if (!isoString) return null
  try {
    const date = new Date(isoString)
    const options: Intl.DateTimeFormatOptions = { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true,
    }
    if (timezone) {
      options.timeZone = timezone
    }
    return date.toLocaleTimeString('en-US', options)
  } catch {
    return null
  }
}

export function FlightStatusBlock({
  status,
  delayMinutes,
  origin,
  destination,
  scheduledDeparture,
  estimatedDeparture,
  actualDeparture,
  scheduledArrival,
  estimatedArrival,
  actualArrival,
}: FlightStatusBlockProps) {
  const meta = STATUS_META[status] ?? STATUS_META.unknown
  
  // Departure times in ORIGIN timezone, arrival times in DESTINATION timezone
  const depTz = origin.timezone
  const arrTz = destination.timezone
  const depScheduled = formatTimeInZone(scheduledDeparture, depTz)
  const depEstimated = formatTimeInZone(estimatedDeparture, depTz)
  const depActual = formatTimeInZone(actualDeparture, depTz)
  const arrScheduled = formatTimeInZone(scheduledArrival, arrTz)
  const arrEstimated = formatTimeInZone(estimatedArrival, arrTz)
  const arrActual = formatTimeInZone(actualArrival, arrTz)

  // Determine what time to show
  const depDisplay = depActual ?? depEstimated ?? depScheduled
  const arrDisplay = arrActual ?? arrEstimated ?? arrScheduled
  
  // Determine if delayed
  const isDelayed = status === 'delayed' && (delayMinutes ?? 0) > 0
  
  // Build delay message
  let delayMessage = ''
  if (isDelayed && depScheduled && depEstimated && depScheduled !== depEstimated) {
    delayMessage = `Originally ${depScheduled} · Now ${depEstimated} · ${delayMinutes} min late`
  } else if (isDelayed && (delayMinutes ?? 0) > 0) {
    delayMessage = `${delayMinutes} min late`
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Status banner */}
      <div className={cn('px-6 py-4 border-b', meta.toneClass)}>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-lg">{meta.label}</span>
          {isDelayed && delayMessage && (
            <span className="text-sm opacity-90">{delayMessage}</span>
          )}
        </div>
        <p className="text-sm mt-1 opacity-80">{meta.message}</p>
      </div>
      
      {/* Departure / Arrival columns */}
      <div className="grid grid-cols-2 divide-x divide-slate-100">
        {/* Departure */}
        <div className="p-6">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Departure</p>
          <p className="text-2xl font-bold text-slate-900">{origin.code}</p>
          {origin.city && <p className="text-slate-600">{origin.city}</p>}
          
          <div className="mt-4">
            {depDisplay ? (
              <p className="text-3xl font-light text-slate-900">{depDisplay}</p>
            ) : (
              <p className="text-3xl font-light text-slate-400">--:--</p>
            )}
            
            {depEstimated && depScheduled && depEstimated !== depScheduled && !actualDeparture && (
              <p className="text-sm text-amber-600 mt-1">
                Originally {depScheduled}
              </p>
            )}
          </div>
          
          {(origin.gate || origin.terminal) && (
            <div className="mt-4 text-sm text-slate-600">
              {origin.gate && <p>Gate {origin.gate}</p>}
              {origin.terminal && <p>Terminal {origin.terminal}</p>}
            </div>
          )}
        </div>
        
        {/* Arrival */}
        <div className="p-6">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Arrival</p>
          <p className="text-2xl font-bold text-slate-900">{destination.code}</p>
          {destination.city && <p className="text-slate-600">{destination.city}</p>}
          
          <div className="mt-4">
            {arrDisplay ? (
              <p className="text-3xl font-light text-slate-900">{arrDisplay}</p>
            ) : (
              <p className="text-3xl font-light text-slate-400">--:--</p>
            )}
            
            {arrEstimated && arrScheduled && arrEstimated !== arrScheduled && !actualArrival && (
              <p className="text-sm text-amber-600 mt-1">
                Originally {arrScheduled}
              </p>
            )}
          </div>
          
          {(destination.gate || destination.terminal) && (
            <div className="mt-4 text-sm text-slate-600">
              {destination.gate && <p>Gate {destination.gate}</p>}
              {destination.terminal && <p>Terminal {destination.terminal}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
