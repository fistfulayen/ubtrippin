'use client'

import { ChevronDown, Search } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import type { PipelineDiary } from '@/types/events'

function coverageLabel(diary: PipelineDiary | null): string {
  const found = diary?.run_metadata?.events_found ?? 0
  if (found >= 20) return 'High'
  if (found >= 8) return 'Medium'
  return 'Early'
}

export function PipelineTransparency({
  diary,
}: {
  diary: PipelineDiary | null
}) {
  if (!diary) return null

  return (
    <Collapsible>
      <Card className="rounded-2xl border-slate-200 bg-slate-50/70 shadow-sm">
        <CardContent className="space-y-4 p-5 font-mono text-sm text-slate-700">
          <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                <Search className="h-4 w-4" />
              </span>
              <div>
                <p className="font-sans text-base font-semibold text-slate-950">How we found these events</p>
                <p className="font-sans text-sm text-slate-600">
                  Last searched {formatDate(diary.run_date)}. Coverage confidence: {coverageLabel(diary)}.
                </p>
              </div>
            </div>
            <ChevronDown className="h-4 w-4" />
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-4">
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Sources checked</p>
                <p className="mt-1 text-slate-950">{diary.run_metadata?.sources_checked ?? 0}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Events found</p>
                <p className="mt-1 text-slate-950">{diary.run_metadata?.events_found ?? 0}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">RSS / Web / AI</p>
                <p className="mt-1 text-slate-950">
                  {diary.run_metadata?.rss_count ?? 0} / {diary.run_metadata?.web_count ?? 0} / {diary.run_metadata?.ai_count ?? 0}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Duplicate rate</p>
                <p className="mt-1 text-slate-950">
                  {typeof diary.run_metadata?.duplicate_rate === 'number'
                    ? `${Math.round(diary.run_metadata.duplicate_rate * 100)}%`
                    : 'n/a'}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-700">
              <p className="mb-2 font-sans text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Pipeline diary
              </p>
              <p className="whitespace-pre-wrap">{diary.diary_text}</p>
            </div>
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  )
}
