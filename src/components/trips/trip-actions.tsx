'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import { FileDown, Plus, GitMerge, Trash2 } from 'lucide-react'
import Link from 'next/link'
import type { Trip } from '@/types/database'

interface TripActionsProps {
  trip: Trip
  allTrips: Pick<Trip, 'id' | 'title' | 'start_date'>[]
}

export function TripActions({ trip, allTrips }: TripActionsProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [merging, setMerging] = useState(false)
  const [mergeTarget, setMergeTarget] = useState<string>('')
  const [mergeOpen, setMergeOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const otherTrips = allTrips.filter((t) => t.id !== trip.id)

  const handleDelete = async () => {
    setDeleting(true)
    const supabase = createClient()

    // First delete all items in this trip
    await supabase.from('trip_items').delete().eq('trip_id', trip.id)

    // Then delete the trip
    await supabase.from('trips').delete().eq('id', trip.id)

    router.push('/trips')
    router.refresh()
  }

  const handleMerge = async () => {
    if (!mergeTarget) return

    setMerging(true)
    const supabase = createClient()

    // Move all items from this trip to the target trip
    await supabase
      .from('trip_items')
      .update({ trip_id: mergeTarget })
      .eq('trip_id', trip.id)

    // Delete this trip
    await supabase.from('trips').delete().eq('id', trip.id)

    router.push(`/trips/${mergeTarget}`)
    router.refresh()
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/trips/${trip.id}/add-item`}>
        <Button variant="outline" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </Link>

      <Link href={`/trips/${trip.id}/pdf`} target="_blank">
        <Button variant="outline" size="sm">
          <FileDown className="mr-2 h-4 w-4" />
          Download PDF
        </Button>
      </Link>

      {otherTrips.length > 0 && (
        <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <GitMerge className="mr-2 h-4 w-4" />
              Merge Into...
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Merge Trip</DialogTitle>
              <DialogDescription>
                Move all items from &quot;{trip.title}&quot; into another trip. This trip will be
                deleted after merging.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Select
                value={mergeTarget}
                onChange={(e) => setMergeTarget(e.target.value)}
              >
                <option value="">Select a trip...</option>
                {otherTrips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </Select>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setMergeOpen(false)}
                disabled={merging}
              >
                Cancel
              </Button>
              <Button
                onClick={handleMerge}
                disabled={!mergeTarget || merging}
              >
                {merging ? 'Merging...' : 'Merge'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Trip</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{trip.title}&quot;? This will also delete all
              items in this trip. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Trip'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
