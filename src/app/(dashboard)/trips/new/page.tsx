import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { UpgradeCard } from '@/components/billing/upgrade-card'
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
        <div className="space-y-4">
          <UpgradeCard
            title="You hit the free trip limit"
            description={`You already have ${limitUsed}/${limitMax} active trips. Upgrade to Pro to create trip #${limitMax + 1} now.`}
            variant="card"
            showEarlyAdopter
          />
          <p className="text-xs text-slate-600">
            You can also archive or delete an existing trip to free up a slot.
          </p>
          <Link
            href="/trips"
            className="inline-flex items-center rounded-md bg-[#1e293b] px-4 py-2 text-sm font-medium text-white hover:bg-[#312e81]"
          >
            Back to trips
          </Link>
        </div>
      ) : (
        <NewTripForm />
      )}
    </div>
  )
}
