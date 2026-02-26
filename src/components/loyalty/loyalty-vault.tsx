'use client'

import { useEffect, useMemo, useState } from 'react'
import { Star, Pencil, Trash2, Copy, Eye, EyeOff, Plus, Award } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  fullName?: string | null
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

const AIRLINE_IATA_BY_PROVIDER_KEY: Record<string, string> = {
  delta: 'DL',
  air_france: 'AF',
  united: 'UA',
  american: 'AA',
  alaska: 'AS',
  spirit: 'NK',
  finnair: 'AY',
  airbaltic: 'BT',
  sas: 'SK',
  la_compagnie: 'B0',
  miles_and_more: 'LH',
}

const FALLBACK_BG_CLASSES = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-indigo-100 text-indigo-700',
]

function providerLabel(type: ProviderType): string {
  if (type === 'car_rental') return 'Car rental'
  if (type === 'other') return 'Other'
  return type.charAt(0).toUpperCase() + type.slice(1)
}

function hashProviderKey(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}

function fallbackColorClass(providerKey: string): string {
  const hash = hashProviderKey(providerKey)
  return FALLBACK_BG_CLASSES[hash % FALLBACK_BG_CLASSES.length]
}

function providerDomain(program: LoyaltyProgram): string | null {
  const normalizedKey = program.provider_key.trim().toLowerCase()
  if (normalizedKey.includes('.')) {
    return normalizedKey
  }

  const normalizedName = program.provider_name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

  if (normalizedName.length === 0) {
    return null
  }

  return `${normalizedName}.com`
}

function logoUrlForProgram(program: LoyaltyProgram): string | null {
  if (program.provider_type === 'airline') {
    const iata = AIRLINE_IATA_BY_PROVIDER_KEY[program.provider_key]
    return iata ? `https://pics.avs.io/80/80/${iata}@2x.png` : null
  }

  const domain = providerDomain(program)
  return domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128` : null
}

export function LoyaltyVault({ isPro, fullName, initialPrograms, initialProviders }: LoyaltyVaultProps) {
  const [saving, setSaving] = useState(false)
  const [programs, setPrograms] = useState<LoyaltyProgram[]>(initialPrograms)
  const [providers] = useState<ProviderCatalogItem[]>(initialProviders)
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({})
  const [brokenLogoIds, setBrokenLogoIds] = useState<Record<string, boolean>>({})
  const [copyMessage, setCopyMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingProgram, setEditingProgram] = useState<LoyaltyProgram | null>(null)
  const [form, setForm] = useState<LoyaltyFormState>(EMPTY_FORM)
  const [providerKeyTouched, setProviderKeyTouched] = useState(false)
  const [activeTraveler, setActiveTraveler] = useState<string>('all')

  const freeLimitReached = !isPro && programs.length >= 3
  const userFullName = fullName?.trim().toLowerCase() ?? ''

  const providerSuggestions = useMemo(
    () => providers.filter((provider) => provider.provider_type === form.provider_type),
    [providers, form.provider_type]
  )

  const sortedPrograms = useMemo(
    () =>
      [...programs].sort((a, b) =>
        a.provider_name.localeCompare(b.provider_name, undefined, { sensitivity: 'base' })
      ),
    [programs]
  )

  const groupedPrograms = useMemo(() => {
    const groups = new Map<string, LoyaltyProgram[]>()

    for (const program of sortedPrograms) {
      const travelerName = program.traveler_name.trim()
      const key = travelerName || program.traveler_name
      const entries = groups.get(key)
      if (entries) {
        entries.push(program)
      } else {
        groups.set(key, [program])
      }
    }

    return Array.from(groups.entries())
      .map(([travelerName, entries]) => ({ travelerName, entries }))
      .sort((a, b) => {
        const aIsUser = userFullName && a.travelerName.trim().toLowerCase() === userFullName
        const bIsUser = userFullName && b.travelerName.trim().toLowerCase() === userFullName
        if (aIsUser && !bIsUser) return -1
        if (!aIsUser && bIsUser) return 1
        return a.travelerName.localeCompare(b.travelerName, undefined, { sensitivity: 'base' })
      })
  }, [sortedPrograms, userFullName])

  const travelerCount = groupedPrograms.length
  const hasMultipleTravelers = travelerCount > 1

  const travelerTabs = useMemo(
    () => [
      { id: 'all', label: 'All' },
      ...groupedPrograms.map((group) => ({ id: group.travelerName, label: group.travelerName })),
    ],
    [groupedPrograms]
  )

  const visibleGroups = useMemo(() => {
    if (activeTraveler === 'all') return groupedPrograms
    return groupedPrograms.filter((group) => group.travelerName === activeTraveler)
  }, [activeTraveler, groupedPrograms])

  useEffect(() => {
    if (activeTraveler === 'all') return
    const travelerStillExists = groupedPrograms.some((group) => group.travelerName === activeTraveler)
    if (!travelerStillExists) {
      setActiveTraveler('all')
    }
  }, [activeTraveler, groupedPrograms])

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
    setForm({
      ...EMPTY_FORM,
      traveler_name: fullName?.trim() ?? '',
    })
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

    const createdProgram = payload.data
    setPrograms((prev) => [...prev, createdProgram])
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

    const updatedProgram = payload.data
    setPrograms((prev) =>
      prev.map((entry) =>
        entry.id === editingProgram.id
          ? { ...entry, ...updatedProgram }
          : entry
      )
    )
    setSaving(false)
    setEditOpen(false)
  }

  function renderProgramCard(program: LoyaltyProgram) {
    const logoUrl = !brokenLogoIds[program.id] ? logoUrlForProgram(program) : null
    const fallbackLetter = program.provider_name.trim().charAt(0).toUpperCase() || '?'

    return (
      <article
        key={program.id}
        className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg text-sm font-semibold ${fallbackColorClass(program.provider_key)}`}
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={`${program.provider_name} logo`}
                  className="h-10 w-10 rounded-lg object-cover"
                  onError={() =>
                    setBrokenLogoIds((prev) => ({
                      ...prev,
                      [program.id]: true,
                    }))
                  }
                />
              ) : (
                fallbackLetter
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-gray-900">{program.provider_name}</p>
              <p className="truncate text-sm text-gray-500">{program.traveler_name}</p>
              {program.status_tier && (
                <p className="mt-1 text-xs text-gray-500">{program.status_tier}</p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {program.preferred && (
              <Star className="h-4 w-4 fill-amber-500 text-amber-500" aria-label="Preferred program" />
            )}
            {program.alliance_group && program.alliance_group !== 'none' && (
              <Badge variant="outline" className="h-6 border-amber-200 bg-amber-50 text-amber-700">
                {program.alliance_group}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
              onClick={() => openEdit(program)}
              aria-label={`Edit ${program.provider_name}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
              onClick={() => handleDelete(program)}
              aria-label={`Delete ${program.provider_name}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-8 flex items-end justify-between gap-4">
          <p className="font-mono text-base text-gray-700">
            {revealedIds[program.id] ? program.program_number : program.program_number_masked}
          </p>

          <div className="flex items-end gap-2">
            <Badge variant="outline" className="border-0 bg-gray-50 text-xs text-gray-400">
              {providerLabel(program.provider_type)}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs"
              onClick={() => handleCopy(program)}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs"
              onClick={() => setRevealedIds((prev) => ({ ...prev, [program.id]: !prev[program.id] }))}
            >
              {revealedIds[program.id] ? (
                <EyeOff className="mr-1.5 h-3.5 w-3.5" />
              ) : (
                <Eye className="mr-1.5 h-3.5 w-3.5" />
              )}
              {revealedIds[program.id] ? 'Hide' : 'Reveal'}
            </Button>
          </div>
        </div>
      </article>
    )
  }

  return (
    <div className="space-y-5">
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {copyMessage && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{copyMessage}</div>}

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Loyalty Programs</h1>
          <p className="mt-1 text-sm text-gray-500">
            {programs.length} {programs.length === 1 ? 'program' : 'programs'} · {travelerCount}{' '}
            {travelerCount === 1 ? 'traveler' : 'travelers'}
          </p>
        </div>
        <Button onClick={openAdd} disabled={freeLimitReached}>
          <Plus className="mr-2 h-4 w-4" />
          Add program
        </Button>
      </header>

      {freeLimitReached && (
        <p className="text-sm text-amber-700">
          Free tier supports 3 loyalty programs. Upgrade to Pro for unlimited.
        </p>
      )}

      {programs.length === 0 && (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center">
          <Award className="mb-3 h-8 w-8 text-gray-400" />
          <p className="text-base font-medium text-gray-900">No loyalty programs yet.</p>
          <p className="mt-2 max-w-md text-sm text-gray-500">
            Add your frequent flyer and hotel membership numbers so we can check your bookings automatically.
          </p>
          <Button className="mt-5" onClick={openAdd} disabled={freeLimitReached}>
            <Plus className="mr-2 h-4 w-4" />
            Add your first program
          </Button>
        </div>
      )}

      {hasMultipleTravelers && programs.length > 0 && (
        <div className="sticky top-16 z-20 -mx-1 border-b border-gray-100 bg-white/95 px-1 py-3 backdrop-blur">
          <div className="overflow-x-auto">
            <div className="flex w-max min-w-full gap-2 pb-1">
              {travelerTabs.map((tab) => {
                const active = activeTraveler === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTraveler(tab.id)}
                    className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm transition-colors ${
                      active
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 bg-white text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {programs.length > 0 && (
        <div className="space-y-5">
          {visibleGroups.map((group, index) => (
            <section key={group.travelerName} className="space-y-3">
              {activeTraveler === 'all' && hasMultipleTravelers && (
                <div className="flex items-center gap-3">
                  {index > 0 && <div className="h-px flex-1 bg-gray-100" />}
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    {group.travelerName}
                  </p>
                  <div className="h-px flex-1 bg-gray-100" />
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {group.entries.map((program) => renderProgramCard(program))}
              </div>
            </section>
          ))}
        </div>
      )}

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
