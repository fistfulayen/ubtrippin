import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plane, SearchX } from 'lucide-react'

export default function FlightNotFound() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="bg-slate-100 rounded-full p-4">
            <SearchX className="h-12 w-12 text-slate-400" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Flight not found
        </h1>
        
        <p className="text-slate-600 mb-6">
          We couldn't find that flight. Double-check the flight number and date, or try searching for a different flight.
        </p>
        
        <div className="space-y-3">
          <Link href="/" className="w-full">
            <Button className="w-full bg-indigo-600 hover:bg-indigo-700">
              <Plane className="mr-2 h-4 w-4" />
              Go to UB Trippin
            </Button>
          </Link>
        </div>
      </div>
    </main>
  )
}
