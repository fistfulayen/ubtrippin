import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

export function FlightPageCta() {
  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 text-center">
      <p className="text-slate-700 font-medium mb-2">
        Track your trips with UB Trippin
      </p>
      <p className="text-slate-500 text-sm mb-4">
        Forward booking emails, get organized trips, share with friends.
      </p>
      <Link href="/">
        <Button className="bg-indigo-600 hover:bg-indigo-700">
          Sign up free <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </Link>
    </div>
  )
}
