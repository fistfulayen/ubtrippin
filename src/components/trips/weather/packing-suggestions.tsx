'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ChevronDown, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PackingList } from '@/lib/weather/types'

interface PackingSuggestionsProps {
  packing: PackingList | null
  locked: boolean
}

function renderPackingItem(item: string | { item: string; reason?: string | null }, index: number) {
  if (typeof item === 'string') {
    return <li key={`${item}-${index}`}>{item}</li>
  }

  return (
    <li key={`${item.item}-${index}`}>
      <span className="font-medium text-slate-800">{item.item}</span>
      {item.reason ? <span className="text-slate-500">. {item.reason}</span> : null}
    </li>
  )
}

export function PackingSuggestions({ packing, locked }: PackingSuggestionsProps) {
  const [open, setOpen] = useState(true)

  return (
    <div className="rounded-2xl border border-[#dbe7f3] bg-white/90 shadow-sm shadow-slate-200/40">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between px-4 py-4 text-left"
      >
        <div>
          <div className="text-base font-semibold text-slate-900">Packing Suggestions</div>
          <div className="text-sm text-slate-500">
            AI-generated based on the full trip, not one city at a time.
          </div>
        </div>
        <ChevronDown className={cn('h-5 w-5 text-slate-500 transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <div className="border-t border-[#e5edf5] px-4 py-4">
          <div className="relative">
            <div className={cn('grid gap-4 md:grid-cols-2', locked && 'select-none blur-sm')}>
              <section>
                <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Essentials</h4>
                <ul className="mt-2 space-y-2 text-sm text-slate-600">
                  {(packing?.essentials ?? ['Passport', 'Chargers', 'Medications']).map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              </section>
              <section>
                <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Clothing</h4>
                <ul className="mt-2 space-y-2 text-sm text-slate-600">
                  {(packing?.clothing ?? ['Layers, because the forecast has trust issues.']).map(renderPackingItem)}
                </ul>
              </section>
              <section>
                <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Footwear</h4>
                <ul className="mt-2 space-y-2 text-sm text-slate-600">
                  {(packing?.footwear ?? ['Walking shoes', 'Backup pair']).map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              </section>
              <section>
                <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Accessories</h4>
                <ul className="mt-2 space-y-2 text-sm text-slate-600">
                  {(packing?.accessories ?? ['Sunglasses', 'Umbrella']).map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              </section>
              <div className="rounded-2xl bg-[#f4f9ff] p-4 md:col-span-2">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Tip</div>
                <p className="mt-2 text-sm text-slate-700">
                  {packing?.tip ?? 'Pack for multiple plot twists. Layers are your co-star.'}
                </p>
              </div>
            </div>

            {locked ? (
              <div className="absolute inset-0 flex items-center justify-center rounded-b-2xl bg-white/70">
                <div className="max-w-sm rounded-2xl border border-[#c9d9eb] bg-white p-5 text-center shadow-lg shadow-slate-200/60">
                  <Lock className="mx-auto h-5 w-5 text-sky-700" />
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    Upgrade to PRO for AI packing suggestions
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Weather is free. The suitcase strategy with personality is not.
                  </p>
                  <Link
                    href="/settings/billing"
                    className="mt-3 inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                  >
                    Upgrade to PRO
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
