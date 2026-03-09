'use client'

import { useState, useTransition } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'

export function EventFeedbackForm({
  cityId,
}: {
  cityId: string
}) {
  const [text, setText] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const submit = () => {
    startTransition(async () => {
      setMessage(null)
      const res = await fetch('/api/v1/events/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city_id: cityId,
          feedback_type: 'suggestion',
          text,
        }),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        setMessage(payload?.error?.message ?? 'Unable to submit feedback.')
        return
      }

      setText('')
      setMessage('Thanks. Your note is queued for review.')
    })
  }

  return (
    <Card className="rounded-2xl border-slate-200 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700">Pro Feedback</p>
          <h3 className="mt-1 font-serif text-2xl text-slate-950">Suggest an event or source</h3>
          <p className="mt-1 text-sm text-slate-600">
            Send a lead, correction, or venue we should keep tracking.
          </p>
        </div>
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Paste a link, venue, or exhibition tip."
          className="min-h-28 rounded-2xl border-slate-200"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">{message ?? 'We strip HTML and queue everything for review.'}</p>
          <Button
            type="button"
            onClick={submit}
            disabled={isPending || text.trim().length === 0}
            className="rounded-xl bg-indigo-600 text-white hover:bg-indigo-500"
          >
            <Send className="mr-2 h-4 w-4" />
            {isPending ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
