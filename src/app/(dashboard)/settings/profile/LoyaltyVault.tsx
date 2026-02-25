'use client'

import { useMemo, useState } from 'react'
import { Star, Pencil, Trash2, Copy, Eye, EyeOff, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { resolveProviderKey } from '@/lib/loyalty-matching'

type ProviderType = 'airline' | 'hotel' | 'car_rental' | 'other'

interface LoyaltyProgram {
  id: string
  traveler_name: string
  provider_type: ProviderType
  provider_name: string
  provider_key: string
  program_number_masked: string
  program_number: string
  status_tier: string | null
  preferred: boolean
  alliance_group: string | null
}

interface ProviderCatalogItem {
  provider_key: string
  provider_name: string
  provider_type: ProviderType
}

interface LoyaltyVaultProps {
  isPro: boolean
  initialPrograms: LoyaltyProgram[]
  initialProviders: ProviderCatalogItem[]
}

interface LoyaltyFormState {
  traveler_name: string
  provider_type: ProviderType
  provider_name: string
  provider_key: string
  program_number: string
  status_tier: string
  preferred: boolean
}

const EMPTY_FORM: LoyaltyFormState = {
  traveler_name: '',
  provider_type: 'airline',
  provider_name: '',
  provider_key: '',
  program_number: '',
  status_tier: '',
  preferred: false,
}

function providerLabel(type: ProviderType): string {
  if (type === 'car_rental') return 'car'
  return type
}

export function LoyaltyVault({ isPro, initialPrograms, initialProviders }: LoyaltyVaultProps) {
  const [saving, setSaving] = useState(false)
  const [programs, setPrograms] = useState<LoyaltyProgram[]>(initialPrograms)
  const [providers] = useState<ProviderCatalogItem[]>(initialProviders)
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({})
  const [copyMessage, setCopyMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingProgram, setEditingProgram] = useState<LoyaltyProgram | null>(null)
  const [form, setForm] = useState<LoyaltyFormState>(EMPTY_FORM)
  const [providerKeyTouched, setProviderKeyTouched] = useState(false)

  const freeLimitReached = !isPro && programs.length >= 3

  const providerSuggestions = useMemo(
    () => providers.filter((provider) => provider.provider_type === form.provider_type),
    [providers, form.provider_type]
  )

  function nextProviderKey(providerType: ProviderType, providerName: string): string {
    const catalogMatch = providers.find(
      (provider) =>
        provider.provider_type === providerType &&
        provider.provider_name.toLowerCase() === providerName.trim().toLowerCase()
    )
    return catalogMatch?.provider_key ?? (providerName.trim() ? resolveProviderKey(providerName) : '')
  }

  async function handleCopy(program: LoyaltyProgram) {
    try {
      await navigator.clipboard.writeText(program.program_number)
      setCopyMessage(`Copied ${program.provider_name} number.`)
      setTimeout(() => setCopyMessage(null), 1600)
    } catch {
      setCopyMessage('Clipboard copy failed.')
      setTimeout(() => setCopyMessage(null), 1600)
    }
  }

  async function handleDelete(program: LoyaltyProgram) {
    if (!window.confirm(`Delete ${program.provider_name} for ${program.traveler_name}?`)) return
    const response = await fetch(`/api/v1/me/loyalty/${program.id}`, { method: 'DELETE' })
    if (!response.ok) {
      setError('Failed to delete loyalty program.')
      return
    }
    setPrograms((prev) => prev.filter((entry) => entry.id !== program.id))
  }

  function openAdd() {
    setForm(EMPTY_FORM)
    setProviderKeyTouched(false)
    setError(null)
    setAddOpen(true)
  }

  function openEdit(program: LoyaltyProgram) {
    setEditingProgram(program)
    setForm({
      traveler_name: program.traveler_name,
      provider_type: program.provider_type,
      provider_name: program.provider_name,
      provider_key: program.provider_key,
      program_number: program.program_number,
      status_tier: program.status_tier ?? '',
      preferred: program.preferred,
    })
    setProviderKeyTouched(false)
    setError(null)
    setEditOpen(true)
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    const response = await fetch('/api/v1/me/loyalty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        traveler_name: form.traveler_name,
        provider_type: form.provider_type,
        provider_name: form.provider_name,
        provider_key: form.provider_key,
        program_number: form.program_number,
        status_tier: form.status_tier || null,
        preferred: form.preferred,
      }),
    })

    const payload = (await response.json()) as { data?: LoyaltyProgram; error?: { message?: string } }
    if (!response.ok || !payload.data) {
      setError(payload.error?.message ?? 'Failed to add loyalty program.')
      setSaving(false)
      return
    }

    setPrograms((prev) => [...prev, payload.data!])
    setSaving(false)
    setAddOpen(false)
  }

  async function handleUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingProgram) return

    setSaving(true)
    setError(null)

    const response = await fetch(`/api/v1/me/loyalty/${editingProgram.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        traveler_name: form.traveler_name,
        program_number: form.program_number,
        status_tier: form.status_tier || null,
        preferred: form.preferred,
      }),
    })

    const payload = (await response.json()) as { data?: LoyaltyProgram; error?: { message?: string } }
    if (!response.ok || !payload.data) {
      setError(payload.error?.message ?? 'Failed to update loyalty program.')
      setSaving(false)
      return
    }

    setPrograms((prev) =>
      prev.map((entry) =>
        entry.id === editingProgram.id
          ? { ...entry, ...payload.data! }
          : entry
      )
    )
    setSaving(false)
    setEditOpen(false)
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {copyMessage && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{copyMessage}</div>}

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">Saved programs: {programs.length}</div>
        <Button onClick={openAdd} disabled={freeLimitReached}>
          <Plus className="mr-2 h-4 w-4" />
          Add loyalty program
        </Button>
      </div>

      {freeLimitReached && (
        <p className="text-sm text-amber-700">
          Free tier supports 3 loyalty programs. Upgrade to Pro for unlimited.
        </p>
      )}

      {programs.length === 0 && (
        <div className="rounded-lg border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-5 text-sm text-gray-600">
          Add your frequent flyer numbers, hotel loyalty IDs, and rental car memberships — we&apos;ll check that they&apos;re applied to your bookings.
        </div>
      )}

      <div className="space-y-3">
        {programs.map((program) => (
          <Card key={program.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{program.provider_name}</p>
                    <span className="text-gray-300">|</span>
                    <p className="text-gray-700">{program.traveler_name}</p>
                    <Badge variant="outline" className="capitalize">
                      {providerLabel(program.provider_type)}
                    </Badge>
                    {program.status_tier && <Badge>{program.status_tier}</Badge>}
                    {program.preferred && program.alliance_group && program.alliance_group !== 'none' && (
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                        <Star className="mr-1 h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                        Preferred
                      </Badge>
                    )}
                  </div>
                  <p className="font-mono text-sm text-gray-700">
                    {revealedIds[program.id] ? program.program_number : program.program_number_masked}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleCopy(program)}>
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRevealedIds((prev) => ({ ...prev, [program.id]: !prev[program.id] }))}
                  >
                    {revealedIds[program.id] ? <EyeOff className="mr-1 h-3.5 w-3.5" /> : <Eye className="mr-1 h-3.5 w-3.5" />}
                    {revealedIds[program.id] ? 'Hide' : 'Reveal'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(program)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(program)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add loyalty program</DialogTitle>
            <DialogDescription>Store your membership so UBT can cross-check bookings.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <Input
              placeholder="Traveler name"
              value={form.traveler_name}
              onChange={(event) => setForm((prev) => ({ ...prev, traveler_name: event.target.value }))}
              required
            />
              <Select
                value={form.provider_type}
                onChange={(event) => {
                  setProviderKeyTouched(false)
                  const nextType = event.target.value as ProviderType
                  setForm((prev) => ({
                    ...prev,
                    provider_type: nextType,
                    provider_name: '',
                    provider_key: nextProviderKey(nextType, ''),
                  }))
                }}
              >
              <option value="airline">Airline</option>
              <option value="hotel">Hotel</option>
              <option value="car_rental">Car rental</option>
              <option value="other">Other</option>
            </Select>
            <Input
              list="provider-catalog"
              placeholder="Provider name"
              value={form.provider_name}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  provider_name: event.target.value,
                  provider_key: providerKeyTouched
                    ? prev.provider_key
                    : nextProviderKey(prev.provider_type, event.target.value),
                }))
              }
              required
            />
            <datalist id="provider-catalog">
              {providerSuggestions.map((provider) => (
                <option key={provider.provider_key} value={provider.provider_name} />
              ))}
            </datalist>
            <Input
              placeholder="Provider key"
              value={form.provider_key}
              onChange={(event) => {
                setProviderKeyTouched(true)
                setForm((prev) => ({ ...prev, provider_key: event.target.value.toLowerCase() }))
              }}
              required
            />
            <Input
              placeholder="Program number"
              value={form.program_number}
              onChange={(event) => setForm((prev) => ({ ...prev, program_number: event.target.value }))}
              required
            />
            <Input
              placeholder="Status tier (optional)"
              value={form.status_tier}
              onChange={(event) => setForm((prev) => ({ ...prev, status_tier: event.target.value }))}
            />
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.preferred}
                onChange={(event) => setForm((prev) => ({ ...prev, preferred: event.target.checked }))}
              />
              Preferred program
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit loyalty program</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-3">
            <Input
              placeholder="Traveler name"
              value={form.traveler_name}
              onChange={(event) => setForm((prev) => ({ ...prev, traveler_name: event.target.value }))}
              required
            />
            <Input value={form.provider_name} disabled />
            <Input
              placeholder="Program number"
              value={form.program_number}
              onChange={(event) => setForm((prev) => ({ ...prev, program_number: event.target.value }))}
              required
            />
            <Input
              placeholder="Status tier (optional)"
              value={form.status_tier}
              onChange={(event) => setForm((prev) => ({ ...prev, status_tier: event.target.value }))}
            />
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.preferred}
                onChange={(event) => setForm((prev) => ({ ...prev, preferred: event.target.checked }))}
              />
              Preferred program
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
