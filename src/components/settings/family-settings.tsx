'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { User, Users, UserPlus, Trash2, Loader2, AlertTriangle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { UserAvatar } from '@/components/user-avatar'

type FamilyRole = 'admin' | 'member'
type SubscriptionTier = 'free' | 'pro'

interface FamilyListItem {
  id: string
  name: string
  role: FamilyRole
  member_count: number
  created_at: string
}

interface FamilyMember {
  id: string
  user_id: string | null
  role: FamilyRole
  name: string | null
  email: string
  invited_email: string
  avatar_url: string | null
  accepted_at: string | null
  pending: boolean
  invited_by_name: string
  created_at: string
}

interface FamilyDetail {
  id: string
  name: string
  viewer_role: FamilyRole
  members: FamilyMember[]
}

interface FamilySettingsProps {
  currentUserId: string
  subscriptionTier: SubscriptionTier
}

function parseApiError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback
  const error = (payload as { error?: { message?: string } }).error
  return error?.message || fallback
}

export function FamilySettings({ currentUserId, subscriptionTier }: FamilySettingsProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [families, setFamilies] = useState<FamilyDetail[]>([])

  const [createName, setCreateName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({})
  const [renamingFamilyId, setRenamingFamilyId] = useState<string | null>(null)

  const [inviteDrafts, setInviteDrafts] = useState<Record<string, string>>({})
  const [invitingFamilyId, setInvitingFamilyId] = useState<string | null>(null)

  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)

  const [deleteFamilyId, setDeleteFamilyId] = useState<string | null>(null)
  const [deletingFamilyId, setDeletingFamilyId] = useState<string | null>(null)

  const isPro = subscriptionTier === 'pro'

  const loadFamilies = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const listResponse = await fetch('/api/v1/families', { cache: 'no-store' })
      const listPayload = await listResponse.json().catch(() => null)

      if (!listResponse.ok) {
        setError(parseApiError(listPayload, 'Failed to load families.'))
        setFamilies([])
        return
      }

      const familyList = ((listPayload as { data?: FamilyListItem[] } | null)?.data ?? [])

      if (familyList.length === 0) {
        setFamilies([])
        return
      }

      const detailResults = await Promise.all(
        familyList.map(async (family) => {
          const res = await fetch(`/api/v1/families/${family.id}`, { cache: 'no-store' })
          const payload = await res.json().catch(() => null)

          if (!res.ok) {
            throw new Error(parseApiError(payload, 'Failed to load family details.'))
          }

          const data = (payload as { data?: FamilyDetail }).data
          if (!data) throw new Error('Missing family detail response data.')
          return data
        })
      )

      setFamilies(detailResults)
      setRenameDrafts(
        Object.fromEntries(detailResults.map((family) => [family.id, family.name]))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load families.')
      setFamilies([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFamilies()
  }, [loadFamilies])

  const selectedDeleteFamily = useMemo(
    () => families.find((family) => family.id === deleteFamilyId) ?? null,
    [deleteFamilyId, families]
  )

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isPro) return

    const name = createName.trim()
    if (!name) {
      setCreateError('Family name is required.')
      return
    }

    setCreating(true)
    setCreateError(null)

    try {
      const response = await fetch('/api/v1/families', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setCreateError(parseApiError(payload, 'Failed to create family.'))
        return
      }

      setCreateName('')
      await loadFamilies()
    } catch {
      setCreateError('Failed to create family.')
    } finally {
      setCreating(false)
    }
  }

  const handleRename = async (familyId: string) => {
    const name = (renameDrafts[familyId] || '').trim()
    if (!name) return

    setRenamingFamilyId(familyId)
    setError(null)

    try {
      const response = await fetch(`/api/v1/families/${familyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        setError(parseApiError(payload, 'Failed to rename family.'))
        return
      }

      await loadFamilies()
    } catch {
      setError('Failed to rename family.')
    } finally {
      setRenamingFamilyId(null)
    }
  }

  const handleInvite = async (familyId: string, event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const email = (inviteDrafts[familyId] || '').trim().toLowerCase()

    if (!email) {
      setError('Invite email is required.')
      return
    }

    setInvitingFamilyId(familyId)
    setError(null)

    try {
      const response = await fetch(`/api/v1/families/${familyId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setError(parseApiError(payload, 'Failed to send invite.'))
        return
      }

      setInviteDrafts((prev) => ({ ...prev, [familyId]: '' }))
      await loadFamilies()
    } catch {
      setError('Failed to send invite.')
    } finally {
      setInvitingFamilyId(null)
    }
  }

  const handleRemoveMember = async (familyId: string, memberId: string) => {
    setRemovingMemberId(memberId)
    setError(null)

    try {
      const response = await fetch(`/api/v1/families/${familyId}/members/${memberId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        setError(parseApiError(payload, 'Failed to remove member.'))
        return
      }

      await loadFamilies()
    } catch {
      setError('Failed to remove member.')
    } finally {
      setRemovingMemberId(null)
    }
  }

  const handleLeaveFamily = async (family: FamilyDetail) => {
    const selfMembership = family.members.find((member) => member.user_id === currentUserId)
    if (!selfMembership) {
      setError('Could not find your family membership row.')
      return
    }

    const confirmed = confirm('Leave this family? You will immediately lose shared access.')
    if (!confirmed) return

    await handleRemoveMember(family.id, selfMembership.id)
  }

  const handleDeleteFamily = async () => {
    if (!deleteFamilyId) return

    setDeletingFamilyId(deleteFamilyId)
    setError(null)

    try {
      const response = await fetch(`/api/v1/families/${deleteFamilyId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        setError(parseApiError(payload, 'Failed to delete family.'))
        return
      }

      setDeleteFamilyId(null)
      await loadFamilies()
    } catch {
      setError('Failed to delete family.')
    } finally {
      setDeletingFamilyId(null)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-gray-600">Loading family settings...</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {families.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Travel is better together.</CardTitle>
            <CardDescription className="max-w-xl text-base leading-7">
              Create a family to share trips, loyalty numbers, city guides, and travel preferences with
              the people you travel with most.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">Sharing is caring.</p>

            {isPro ? (
              <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row">
                <Input
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  placeholder="Rogers Family"
                  maxLength={120}
                />
                <Button type="submit" disabled={creating}>
                  {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
                  {creating ? 'Creating...' : '+ Create a Family'}
                </Button>
              </form>
            ) : (
              <div className="rounded-lg border border-[#cbd5e1] bg-[#f8fafc] p-4 text-sm text-[#1e293b]">
                Family sharing is a Pro feature. Upgrade to Pro to create a family and invite members.
              </div>
            )}

            {createError && <p className="text-sm text-red-600">{createError}</p>}
          </CardContent>
        </Card>
      ) : (
        <>
          {isPro && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Create another family</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row">
                  <Input
                    value={createName}
                    onChange={(event) => setCreateName(event.target.value)}
                    placeholder="Family name"
                    maxLength={120}
                  />
                  <Button type="submit" disabled={creating}>
                    {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
                    {creating ? 'Creating...' : 'Create Family'}
                  </Button>
                </form>
                {createError && <p className="mt-2 text-sm text-red-600">{createError}</p>}
              </CardContent>
            </Card>
          )}

          {families.map((family) => {
            const isAdmin = family.viewer_role === 'admin'
            const acceptedMembers = family.members.filter((member) => !member.pending)
            const pendingMembers = family.members.filter((member) => member.pending)

            return (
              <Card key={family.id}>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1">
                      {isAdmin ? (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <Input
                            value={renameDrafts[family.id] ?? family.name}
                            onChange={(event) =>
                              setRenameDrafts((prev) => ({ ...prev, [family.id]: event.target.value }))
                            }
                            maxLength={120}
                            className="max-w-sm"
                          />
                          <Button
                            size="sm"
                            onClick={() => handleRename(family.id)}
                            disabled={renamingFamilyId === family.id}
                          >
                            {renamingFamilyId === family.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            Save name
                          </Button>
                        </div>
                      ) : (
                        <CardTitle>{family.name}</CardTitle>
                      )}
                    </div>
                    <Badge variant={isAdmin ? 'default' : 'secondary'}>
                      {isAdmin ? 'Admin' : 'Member'}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-700">Members</h4>
                    <div className="space-y-2">
                      {acceptedMembers.map((member) => {
                        const joinedAt = member.accepted_at
                          ? new Date(member.accepted_at).toLocaleDateString()
                          : null

                        return (
                          <div
                            key={member.id}
                            className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-3"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <UserAvatar
                                src={member.avatar_url}
                                name={member.name}
                                email={member.email}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <p className="truncate font-medium text-gray-900">
                                  {member.name || member.email}
                                </p>
                                <p className="truncate text-sm text-gray-500">{member.email}</p>
                                {joinedAt && (
                                  <p className="text-xs text-gray-400">Joined {joinedAt}</p>
                                )}
                              </div>
                            </div>
                            <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                              {member.role}
                            </Badge>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {pendingMembers.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-700">Pending invites</h4>
                      <div className="space-y-2">
                        {pendingMembers.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 p-3"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium text-gray-900">{member.invited_email}</p>
                              <p className="text-xs text-gray-500">
                                Invited by {member.invited_by_name} on{' '}
                                {new Date(member.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={removingMemberId === member.id}
                                onClick={() => handleRemoveMember(family.id, member.id)}
                                className="text-red-600 hover:bg-red-100"
                              >
                                {removingMemberId === member.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  'Cancel'
                                )}
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isAdmin && (
                    <form onSubmit={(event) => handleInvite(family.id, event)} className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-700">Invite a family member</h4>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <Input
                          type="email"
                          placeholder="hedvig@example.com"
                          value={inviteDrafts[family.id] ?? ''}
                          onChange={(event) =>
                            setInviteDrafts((prev) => ({ ...prev, [family.id]: event.target.value }))
                          }
                        />
                        <Button type="submit" disabled={invitingFamilyId === family.id}>
                          {invitingFamilyId === family.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <UserPlus className="mr-2 h-4 w-4" />
                          )}
                          Invite
                        </Button>
                      </div>
                    </form>
                  )}

                  <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <h4 className="text-sm font-medium text-red-700">Danger zone</h4>
                    <p className="mt-1 text-sm text-red-600">
                      Leaving removes shared access immediately.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleLeaveFamily(family)}
                        disabled={removingMemberId !== null}
                      >
                        <User className="mr-2 h-4 w-4" />
                        Leave family
                      </Button>

                      {isAdmin && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteFamilyId(family.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete family
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </>
      )}

      <Dialog open={!!deleteFamilyId} onOpenChange={(open) => !open && setDeleteFamilyId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete family?</DialogTitle>
            <DialogDescription>
              This permanently removes {selectedDeleteFamily?.name || 'this family'} and all memberships.
              Shared access will be revoked immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>This action cannot be undone.</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteFamilyId(null)}
              disabled={deletingFamilyId !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteFamily}
              disabled={deletingFamilyId !== null}
            >
              {deletingFamilyId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete family
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
