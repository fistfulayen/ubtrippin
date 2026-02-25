'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { TripItemKind } from '@/types/database'

interface AddItemPageProps {
  params: Promise<{ id: string }>
}

export default function AddItemPage({ params }: AddItemPageProps) {
  const { id: tripId } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const kind = formData.get('kind') as TripItemKind
    const provider = formData.get('provider') as string
    const confirmation_code = formData.get('confirmation_code') as string
    const start_date = formData.get('start_date') as string
    const end_date = formData.get('end_date') as string
    const start_time = formData.get('start_time') as string
    const end_time = formData.get('end_time') as string
    const start_location = formData.get('start_location') as string
    const end_location = formData.get('end_location') as string
    const summary = formData.get('summary') as string
    const travelers = (formData.get('travelers') as string)
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in')
      setLoading(false)
      return
    }

    // Combine date and time for timestamps
    const start_ts = start_date && start_time
      ? new Date(`${start_date}T${start_time}`).toISOString()
      : null
    const end_ts = end_date && end_time
      ? new Date(`${end_date}T${end_time}`).toISOString()
      : null

    const { data: insertedItem, error: insertError } = await supabase.from('trip_items').insert({
      user_id: user.id,
      trip_id: tripId,
      kind,
      provider: provider || null,
      confirmation_code: confirmation_code || null,
      start_date,
      end_date: end_date || null,
      start_ts,
      end_ts,
      start_location: start_location || null,
      end_location: end_location || null,
      summary: summary || null,
      traveler_names: travelers.length > 0 ? travelers : [],
      status: 'confirmed',
      confidence: 1.0,
      needs_review: false,
    }).select('id, provider').single()

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    if (insertedItem?.id && provider.trim()) {
      try {
        const lookupRes = await fetch(`/api/v1/me/loyalty/lookup?provider=${encodeURIComponent(provider)}`)
        if (lookupRes.ok) {
          const lookupPayload = await lookupRes.json() as { exact_match?: boolean; compatible_program?: unknown }
          if (!lookupPayload.exact_match && !lookupPayload.compatible_program) {
            await supabase
              .from('trip_items')
              .update({
                loyalty_flag: {
                  status: 'no_vault_entry',
                  provider_name: provider.trim(),
                  flagged_at: new Date().toISOString(),
                },
              })
              .eq('id', insertedItem.id)
          }
        }
      } catch {
        // non-blocking
      }
    }

    router.push(`/trips/${tripId}`)
    router.refresh()
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href={`/trips/${tripId}`}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to trip
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Item</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="kind" className="text-sm font-medium text-gray-700">
                Type *
              </label>
              <Select id="kind" name="kind" required>
                <option value="flight">Flight</option>
                <option value="hotel">Hotel</option>
                <option value="train">Train</option>
                <option value="car">Car Rental</option>
                <option value="restaurant">Restaurant</option>
                <option value="activity">Activity</option>
                <option value="other">Other</option>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="provider" className="text-sm font-medium text-gray-700">
                  Provider / Name
                </label>
                <Input
                  id="provider"
                  name="provider"
                  placeholder="e.g., United Airlines, Hilton"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="confirmation_code" className="text-sm font-medium text-gray-700">
                  Confirmation Code
                </label>
                <Input
                  id="confirmation_code"
                  name="confirmation_code"
                  placeholder="e.g., ABC123"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="start_date" className="text-sm font-medium text-gray-700">
                  Start Date *
                </label>
                <Input id="start_date" name="start_date" type="date" required />
              </div>

              <div className="space-y-2">
                <label htmlFor="start_time" className="text-sm font-medium text-gray-700">
                  Start Time
                </label>
                <Input id="start_time" name="start_time" type="time" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="end_date" className="text-sm font-medium text-gray-700">
                  End Date
                </label>
                <Input id="end_date" name="end_date" type="date" />
              </div>

              <div className="space-y-2">
                <label htmlFor="end_time" className="text-sm font-medium text-gray-700">
                  End Time
                </label>
                <Input id="end_time" name="end_time" type="time" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="start_location" className="text-sm font-medium text-gray-700">
                  Start Location
                </label>
                <Input
                  id="start_location"
                  name="start_location"
                  placeholder="e.g., SFO or San Francisco"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="end_location" className="text-sm font-medium text-gray-700">
                  End Location
                </label>
                <Input
                  id="end_location"
                  name="end_location"
                  placeholder="e.g., LAX or Los Angeles"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="travelers" className="text-sm font-medium text-gray-700">
                Travelers
              </label>
              <Input
                id="travelers"
                name="travelers"
                placeholder="Names separated by commas"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="summary" className="text-sm font-medium text-gray-700">
                Summary / Notes
              </label>
              <Textarea
                id="summary"
                name="summary"
                rows={2}
                placeholder="Additional details..."
              />
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={loading}>
                {loading ? 'Adding...' : 'Add Item'}
              </Button>
              <Link href={`/trips/${tripId}`}>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
