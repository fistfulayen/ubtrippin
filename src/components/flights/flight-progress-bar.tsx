interface FlightProgressBarProps {
  originCode: string
  destinationCode: string
  progressPercent: number | null
  status: string
}

export function FlightProgressBar({
  originCode,
  destinationCode,
  progressPercent,
  status,
}: FlightProgressBarProps) {
  // Only show for en_route or landed flights
  if (status !== 'en_route' && status !== 'landed' && status !== 'arrived') {
    return null
  }

  const progress = progressPercent ?? 0
  const isLanded = status === 'landed' || status === 'arrived'
  const displayProgress = isLanded ? 100 : progress

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-4">
        Flight Progress
      </p>
      
      <div className="relative">
        {/* Track */}
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          {/* Fill */}
          <div 
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${displayProgress}%` }}
          />
        </div>
        
        {/* Plane icon at current position */}
        <div 
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-500"
          style={{ left: `${displayProgress}%` }}
        >
          <div className="bg-white rounded-full p-1 shadow-md border border-slate-200">
            <svg 
              className="w-4 h-4 text-blue-600" 
              fill="currentColor" 
              viewBox="0 0 24 24"
              style={{ transform: 'rotate(90deg)' }}
            >
              <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
            </svg>
          </div>
        </div>
      </div>
      
      {/* Labels */}
      <div className="flex justify-between mt-3 text-sm text-slate-600">
        <span>{originCode}</span>
        <span className="font-medium text-slate-900">
          {isLanded ? 'Landed' : `${Math.round(displayProgress)}%`}
        </span>
        <span>{destinationCode}</span>
      </div>
    </div>
  )
}
