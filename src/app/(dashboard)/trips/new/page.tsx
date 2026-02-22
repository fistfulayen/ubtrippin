import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { checkTripLimit } from '@/lib/usage/limits'
import NewTripForm from './new-trip-form'

export default async function NewTripPage() {
  // Get current user server-side
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Check trip limit for authenticated users
  let limitHit = false
  let limitUsed = 0
  let limitMax = 3

  if (user) {
    const tripLimit = await checkTripLimit(user.id)
    if (!tripLimit.allowed) {
      limitHit = true
      limitUsed = tripLimit.used
      limitMax = tripLimit.limit ?? 3
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href="/trips"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to trips
        </Link>
      </div>

      {limitHit ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 space-y-3">
          <h2 className="text-lg font-semibold text-amber-900">Trip limit reached</h2>
          <p className="text-sm text-amber-800">
            You&apos;ve used {limitUsed} of {limitMax} trips on the free plan. Upgrade to{' '}
            <strong>Pro</strong> for unlimited trips.
          </p>
          <p className="text-xs text-amber-700">
            Alternatively, delete an existing trip to free up a slot.
          </p>
          <div className="flex gap-3 pt-2">
            <Link
              href="/trips"
              className="inline-flex items-center rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
            >
              Back to trips
            </Link>
            {/* Upgrade link placeholder — wire up Stripe when billing is ready */}
            <Link
              href="/settings"
              className="inline-flex items-center rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50"
            >
              Upgrade to Pro
            </Link>
          </div>
        </div>
      ) : (
        <NewTripForm />
      )}
    </div>
  )
}
