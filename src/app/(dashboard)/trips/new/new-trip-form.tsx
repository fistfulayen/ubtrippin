'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { fetchAndSetCoverImage } from './actions'

export default function NewTripForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const title = formData.get('title') as string
    const primary_location = formData.get('location') as string
    const start_date = formData.get('start_date') as string
    const end_date = formData.get('end_date') as string
    const notes = formData.get('notes') as string
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

    const { data, error: insertError } = await supabase
      .from('trips')
      .insert({
        user_id: user.id,
        title,
        primary_location: primary_location || null,
        start_date: start_date || null,
        end_date: end_date || null,
        notes: notes || null,
        travelers: travelers.length > 0 ? travelers : [],
      })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    // Fetch cover image in the background (don't block navigation)
    if (primary_location) {
      fetchAndSetCoverImage(data.id, primary_location)
    }

    router.push(`/trips/${data.id}`)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Trip</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium text-gray-700">
              Trip Name *
            </label>
            <Input
              id="title"
              name="title"
              required
              placeholder="e.g., Summer Europe Trip 2024"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="location" className="text-sm font-medium text-gray-700">
              Primary Location
            </label>
            <Input
              id="location"
              name="location"
              placeholder="e.g., Paris, France"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="start_date" className="text-sm font-medium text-gray-700">
                Start Date
              </label>
              <Input id="start_date" name="start_date" type="date" />
            </div>

            <div className="space-y-2">
              <label htmlFor="end_date" className="text-sm font-medium text-gray-700">
                End Date
              </label>
              <Input id="end_date" name="end_date" type="date" />
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
            <p className="text-xs text-gray-500">
              Add names of people traveling, separated by commas
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="notes" className="text-sm font-medium text-gray-700">
              Notes
            </label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Any additional notes for this trip..."
            />
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Trip'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
