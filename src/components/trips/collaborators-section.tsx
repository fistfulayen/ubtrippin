'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  removeCollaborator,
  sendCollaboratorInvite,
} from '@/app/(dashboard)/trips/actions'
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
import { UserPlus, UserX, Loader2, CheckCircle2, Clock } from 'lucide-react'

interface Collaborator {
  id: string
  user_id: string | null
  role: string
  invited_email: string
  accepted_at: string | null
  created_at: string
}

interface CollaboratorsSectionProps {
  tripId: string
  collaborators: Collaborator[]
  isOwner: boolean
}

export function CollaboratorsSection({
  tripId,
  collaborators,
  isOwner,
}: CollaboratorsSectionProps) {
  const router = useRouter()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  const handleInvite = async () => {
    if (!email.trim()) return
    setInviting(true)
    setInviteError(null)

    try {
      const result = await sendCollaboratorInvite(tripId, email, role)

      if (result.error) {
        setInviteError(result.error)
        return
      }

      setInviteSuccess(true)
      setTimeout(() => {
        setInviteOpen(false)
        setEmail('')
        setRole('editor')
        setInviteSuccess(false)
        router.refresh()
      }, 1500)
    } catch {
      setInviteError('Something went wrong. Please try again.')
    } finally {
      setInviting(false)
    }
  }

  const handleRemove = async (collabId: string) => {
    setRemoving(collabId)
    try {
      await removeCollaborator(tripId, collabId)

      router.refresh()
    } finally {
      setRemoving(null)
    }
  }

  if (!isOwner && collaborators.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Travelers
        </h3>
        {isOwner && (
          <Dialog
            open={inviteOpen}
            onOpenChange={(open) => {
              setInviteOpen(open)
              if (!open) {
                setEmail('')
                setRole('editor')
                setInviteError(null)
                setInviteSuccess(false)
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <UserPlus className="mr-2 h-4 w-4" />
                Invite
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite a co-traveler</DialogTitle>
                <DialogDescription>
                  They&apos;ll receive an email with a link to join this trip.
                </DialogDescription>
              </DialogHeader>

              {inviteSuccess ? (
                <div className="flex items-center gap-2 py-4 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Invite sent!</span>
                </div>
              ) : (
                <div className="space-y-4 py-2">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">
                      Email address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="friend@example.com"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">
                      Role
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="editor">Editor — can view and add items</option>
                      <option value="viewer">Viewer — can view only</option>
                    </select>
                  </div>

                  {inviteError && (
                    <p className="text-sm text-red-600">{inviteError}</p>
                  )}
                </div>
              )}

              {!inviteSuccess && (
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setInviteOpen(false)}
                    disabled={inviting}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleInvite}
                    disabled={!email.trim() || inviting}
                  >
                    {inviting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Send invite'
                    )}
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>

      {collaborators.length > 0 && (
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
          {collaborators.map((collab) => (
            <div
              key={collab.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-gray-900">
                  {collab.invited_email}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                  <span className="capitalize">{collab.role}</span>
                  <span>·</span>
                  {collab.accepted_at ? (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-3 w-3" />
                      Joined
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-600">
                      <Clock className="h-3 w-3" />
                      Pending
                    </span>
                  )}
                </div>
              </div>

              {isOwner && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                  onClick={() => handleRemove(collab.id)}
                  disabled={removing === collab.id}
                >
                  {removing === collab.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserX className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {isOwner && collaborators.length === 0 && (
        <p className="text-sm text-gray-500">No co-travelers yet. Invite someone!</p>
      )}
    </div>
  )
}
