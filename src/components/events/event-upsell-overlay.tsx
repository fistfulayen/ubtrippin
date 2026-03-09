import Link from 'next/link'
import { Lock } from 'lucide-react'

export function EventUpsellOverlay({
  visible,
  hiddenCount,
}: {
  visible: boolean
  hiddenCount: number
}) {
  if (!visible || hiddenCount <= 0) return null

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-[600px] items-end justify-center bg-gradient-to-t from-white via-white/90 to-transparent px-4 pb-8">
      <div className="pointer-events-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-lg">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
          <Lock className="h-5 w-5" />
        </div>
        <h3 className="mt-4 font-serif text-2xl text-slate-950">Unlock the Full Calendar</h3>
        <p className="mt-2 text-sm text-slate-600">
          {hiddenCount} more curated events are waiting below the fold.
        </p>
        <Link
          href="/settings/billing"
          className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
        >
          Upgrade to Pro
        </Link>
      </div>
    </div>
  )
}
