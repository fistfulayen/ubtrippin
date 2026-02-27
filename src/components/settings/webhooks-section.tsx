'use client'

import { Fragment, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Check, ChevronDown, ChevronRight, Copy, FlaskConical, Plus, RefreshCw, Trash2, WandSparkles } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type Tier = 'free' | 'pro'

interface WebhooksSectionProps {
  subscriptionTier: Tier
}

interface WebhookRow {
  id: string
  url: string
  description: string | null
  secret_masked: string
  events: string[]
  enabled: boolean
  created_at: string
  updated_at: string
}

interface DeliveryRow {
  id: string
  webhook_id: string
  event: string
  status: 'pending' | 'success' | 'failed'
  attempts: number
  last_attempt_at: string | null
  last_response_code: number | null
  last_response_body: string | null
  payload?: unknown
  created_at: string
}

const PAGE_SIZE = 10
const ALL_EVENTS = [
  { name: 'trip.created', description: 'A new trip is created' },
  { name: 'trip.updated', description: 'Trip metadata is updated' },
  { name: 'trip.deleted', description: 'A trip is deleted' },
  { name: 'item.created', description: 'A new item is added to a trip' },
  { name: 'item.updated', description: 'An item is modified' },
  { name: 'item.deleted', description: 'An item is removed' },
  { name: 'item.status_changed', description: 'A live item status changes (flight status updates)' },
  { name: 'items.batch_created', description: 'Multiple items added at once' },
  { name: 'collaborator.invited', description: 'A collaborator is invited' },
  { name: 'collaborator.accepted', description: 'A collaborator accepts' },
  { name: 'collaborator.removed', description: 'A collaborator is removed' },
] as const

function truncateUrl(url: string): string {
  if (url.length <= 48) return url
  return `${url.slice(0, 45)}...`
}

async function parseApiError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: { message?: string } }
    return payload.error?.message ?? 'Request failed.'
  } catch {
    return 'Request failed.'
  }
}

function statusBadge(delivery: DeliveryRow | undefined) {
  if (!delivery) {
    return <Badge variant="outline">No deliveries</Badge>
  }

  const code = delivery.last_response_code ?? 0
  if (delivery.status === 'pending') {
    return <Badge variant="warning">Pending</Badge>
  }
  if (code >= 200 && code < 300) {
    return <Badge variant="success">{code}</Badge>
  }
  if (code >= 400) {
    return <Badge variant="error">{code}</Badge>
  }
  if (delivery.status === 'success') {
    return <Badge variant="success">Success</Badge>
  }
  return <Badge variant="error">Failed</Badge>
}

function generateHexSecret() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function WebhooksSection({ subscriptionTier }: WebhooksSectionProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([])
  const [deliveryByWebhook, setDeliveryByWebhook] = useState<Record<string, DeliveryRow | undefined>>({})

  const [addOpen, setAddOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [addUrl, setAddUrl] = useState('')
  const [addDescription, setAddDescription] = useState('')
  const [addSecret, setAddSecret] = useState('')
  const [addEvents, setAddEvents] = useState<string[]>([])
  const [copiedSecret, setCopiedSecret] = useState(false)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [testStatus, setTestStatus] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  const [detailUrl, setDetailUrl] = useState('')
  const [detailDescription, setDetailDescription] = useState('')
  const [detailEnabled, setDetailEnabled] = useState(true)
  const [detailEvents, setDetailEvents] = useState<string[]>([])
  const [detailSecret, setDetailSecret] = useState('')

  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([])
  const [deliveryPage, setDeliveryPage] = useState(1)
  const [expandedDeliveries, setExpandedDeliveries] = useState<Record<string, boolean>>({})
  const [loadingDeliveries, setLoadingDeliveries] = useState(false)
  const [deliveriesError, setDeliveriesError] = useState<string | null>(null)

  const maxWebhooks = subscriptionTier === 'pro' ? 10 : 1
  const reachedLimit = webhooks.length >= maxWebhooks

  const selectedWebhook = useMemo(
    () => webhooks.find((webhook) => webhook.id === selectedId) ?? null,
    [webhooks, selectedId]
  )

  const totalPages = Math.max(1, Math.ceil(deliveries.length / PAGE_SIZE))
  const pagedDeliveries = useMemo(() => {
    const start = (deliveryPage - 1) * PAGE_SIZE
    return deliveries.slice(start, start + PAGE_SIZE)
  }, [deliveries, deliveryPage])

  const syncDetailForm = useCallback((webhook: WebhookRow | null) => {
    if (!webhook) return
    setDetailUrl(webhook.url)
    setDetailDescription(webhook.description ?? '')
    setDetailEnabled(webhook.enabled)
    setDetailEvents(webhook.events ?? [])
    setDetailSecret('')
    setSaveError(null)
    setTestStatus(null)
  }, [])

  const fetchDeliveriesForWebhook = useCallback(async (id: string) => {
    setLoadingDeliveries(true)
    setDeliveriesError(null)
    try {
      const response = await fetch(`/api/v1/webhooks/${id}/deliveries`)
      if (!response.ok) {
        setDeliveriesError(await parseApiError(response))
        setDeliveries([])
        return
      }
      const payload = (await response.json()) as { data?: DeliveryRow[] }
      setDeliveries(payload.data ?? [])
      setDeliveryPage(1)
      setExpandedDeliveries({})
    } catch {
      setDeliveriesError('Failed to load delivery logs.')
      setDeliveries([])
    } finally {
      setLoadingDeliveries(false)
    }
  }, [])

  const fetchWebhooks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/v1/webhooks')
      if (!response.ok) {
        setError(await parseApiError(response))
        setWebhooks([])
        return
      }

      const payload = (await response.json()) as { data?: WebhookRow[] }
      const list = payload.data ?? []
      setWebhooks(list)

      const lastDeliveries = await Promise.all(
        list.map(async (webhook) => {
          try {
            const deliveryResponse = await fetch(`/api/v1/webhooks/${webhook.id}/deliveries`)
            if (!deliveryResponse.ok) return [webhook.id, undefined] as const
            const deliveryPayload = (await deliveryResponse.json()) as { data?: DeliveryRow[] }
            return [webhook.id, deliveryPayload.data?.[0]] as const
          } catch {
            return [webhook.id, undefined] as const
          }
        })
      )

      const byWebhook = Object.fromEntries(lastDeliveries) as Record<string, DeliveryRow | undefined>
      setDeliveryByWebhook(byWebhook)

      const keepCurrent = list.find((webhook) => webhook.id === selectedId)
      if (keepCurrent) {
        syncDetailForm(keepCurrent)
      } else if (list[0]) {
        setSelectedId(list[0].id)
        syncDetailForm(list[0])
      } else {
        setSelectedId(null)
        setDeliveries([])
      }
    } catch {
      setError('Failed to load webhooks.')
      setWebhooks([])
    } finally {
      setLoading(false)
    }
  }, [selectedId, syncDetailForm])

  useEffect(() => {
    fetchWebhooks()
  }, [fetchWebhooks])

  useEffect(() => {
    if (!selectedId) return
    fetchDeliveriesForWebhook(selectedId)
  }, [fetchDeliveriesForWebhook, selectedId])

  useEffect(() => {
    if (!selectedWebhook) return
    syncDetailForm(selectedWebhook)
  }, [selectedWebhook, syncDetailForm])

  const resetAddForm = () => {
    setAddUrl('')
    setAddDescription('')
    setAddSecret('')
    setAddEvents([])
    setCreateError(null)
    setCopiedSecret(false)
  }

  const toggleEvent = (eventName: string, current: string[], setCurrent: (value: string[]) => void) => {
    setCurrent(
      current.includes(eventName)
        ? current.filter((entry) => entry !== eventName)
        : [...current, eventName]
    )
  }

  const onCreateWebhook = async (event: FormEvent) => {
    event.preventDefault()
    setCreating(true)
    setCreateError(null)

    try {
      const response = await fetch('/api/v1/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: addUrl.trim(),
          description: addDescription.trim() || null,
          secret: addSecret.trim(),
          events: addEvents,
        }),
      })

      if (!response.ok) {
        setCreateError(await parseApiError(response))
        return
      }

      setAddOpen(false)
      resetAddForm()
      await fetchWebhooks()
    } catch {
      setCreateError('Failed to create webhook.')
    } finally {
      setCreating(false)
    }
  }

  const onDeleteWebhook = async (id: string) => {
    if (!confirm('Delete this webhook and its pending deliveries?')) return
    setDeleting(id)
    try {
      const response = await fetch(`/api/v1/webhooks/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        setSaveError(await parseApiError(response))
        return
      }
      await fetchWebhooks()
    } catch {
      setSaveError('Failed to delete webhook.')
    } finally {
      setDeleting(null)
    }
  }

  const onToggleEnabled = async (webhook: WebhookRow, enabled: boolean) => {
    const prev = webhook.enabled
    setWebhooks((current) => current.map((row) => (row.id === webhook.id ? { ...row, enabled } : row)))
    try {
      const response = await fetch(`/api/v1/webhooks/${webhook.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      if (!response.ok) {
        setWebhooks((current) => current.map((row) => (row.id === webhook.id ? { ...row, enabled: prev } : row)))
      }
    } catch {
      setWebhooks((current) => current.map((row) => (row.id === webhook.id ? { ...row, enabled: prev } : row)))
    }
  }

  const onSaveWebhook = async () => {
    if (!selectedId) return
    setSaving(true)
    setSaveError(null)
    try {
      const body: Record<string, unknown> = {
        url: detailUrl.trim(),
        description: detailDescription.trim() || null,
        enabled: detailEnabled,
        events: detailEvents,
      }
      if (detailSecret.trim()) {
        body.secret = detailSecret.trim()
      }

      const response = await fetch(`/api/v1/webhooks/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        setSaveError(await parseApiError(response))
        return
      }

      const payload = (await response.json()) as { data?: WebhookRow }
      const next = payload.data
      if (next) {
        setWebhooks((current) => current.map((row) => (row.id === next.id ? next : row)))
        syncDetailForm(next)
      }
      await fetchWebhooks()
    } catch {
      setSaveError('Failed to update webhook.')
    } finally {
      setSaving(false)
    }
  }

  const onTestWebhook = async () => {
    if (!selectedId) return
    setTesting(true)
    setTestStatus(null)
    try {
      const response = await fetch(`/api/v1/webhooks/${selectedId}/test`, { method: 'POST' })
      if (!response.ok) {
        setTestStatus(`Test failed: ${await parseApiError(response)}`)
        return
      }
      setTestStatus('Test ping queued.')
      await fetchDeliveriesForWebhook(selectedId)
      await fetchWebhooks()
    } catch {
      setTestStatus('Test failed.')
    } finally {
      setTesting(false)
    }
  }

  const copySecret = async (value: string) => {
    await navigator.clipboard.writeText(value)
    setCopiedSecret(true)
    setTimeout(() => setCopiedSecret(false), 1800)
  }

  return (
    <div className="space-y-6">
      {subscriptionTier === 'free' && reachedLimit && (
        <div className="rounded-lg border border-[#cbd5e1] bg-[#ffffff] p-3 text-sm text-[#1e293b]">
          <p>Free tier supports 1 webhook. Upgrade to Pro for up to 10.</p>
          <Link
            href="/settings/billing"
            className="mt-2 inline-flex items-center rounded-md border border-[#cbd5e1] bg-white px-3 py-1.5 text-sm font-medium text-[#1e293b] hover:bg-gray-50"
          >
            Upgrade to Pro
          </Link>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-gray-700">Registered webhooks</h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchWebhooks} disabled={loading}>
            <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)} disabled={reachedLimit}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Webhook
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
          Loading webhooks...
        </div>
      ) : webhooks.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center text-sm text-gray-600">
          No webhooks configured yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[900px] divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">URL</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Events</th>
                <th className="px-4 py-3">Enabled</th>
                <th className="px-4 py-3">Last Delivery</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {webhooks.map((webhook) => {
                const isSelected = selectedId === webhook.id
                return (
                  <tr key={webhook.id} className={cn(isSelected && 'bg-[#f8fafc]')}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">
                      {truncateUrl(webhook.url)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {webhook.description || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {webhook.events.length === 0 ? ALL_EVENTS.length : webhook.events.length}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className={cn(
                          'inline-flex h-6 w-11 items-center rounded-full transition-colors',
                          webhook.enabled ? 'bg-[#1e293b]' : 'bg-gray-300'
                        )}
                        onClick={() => onToggleEnabled(webhook, !webhook.enabled)}
                        aria-label={webhook.enabled ? 'Disable webhook' : 'Enable webhook'}
                      >
                        <span
                          className={cn(
                            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                            webhook.enabled ? 'translate-x-6' : 'translate-x-1'
                          )}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {statusBadge(deliveryByWebhook[webhook.id])}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => setSelectedId(webhook.id)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-700 hover:bg-red-50 hover:text-red-800"
                          onClick={() => onDeleteWebhook(webhook.id)}
                          disabled={deleting === webhook.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedWebhook && (
        <div className="rounded-lg border border-[#cbd5e1] bg-white p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-base font-semibold text-gray-900">Webhook Detail</h4>
              <p className="text-xs text-gray-500">ID: {selectedWebhook.id}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={onTestWebhook} disabled={testing}>
                <FlaskConical className="mr-1.5 h-4 w-4" />
                {testing ? 'Testing...' : 'Send Test Ping'}
              </Button>
              <Button size="sm" onClick={onSaveWebhook} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>

          {saveError && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {saveError}
            </div>
          )}
          {testStatus && (
            <div className="rounded-lg bg-[#f1f5f9] p-3 text-sm text-[#1e293b]">
              {testStatus}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium text-gray-700">URL</label>
              <Input value={detailUrl} onChange={(event) => setDetailUrl(event.target.value)} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium text-gray-700">Description</label>
              <Textarea
                value={detailDescription}
                onChange={(event) => setDetailDescription(event.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Current secret</label>
              <Input value={selectedWebhook.secret_masked} readOnly />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Rotate secret</label>
              <div className="flex items-center gap-2">
                <Input
                  value={detailSecret}
                  onChange={(event) => setDetailSecret(event.target.value)}
                  placeholder="Leave blank to keep existing secret"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setDetailSecret(generateHexSecret())}
                >
                  <WandSparkles className="mr-1.5 h-3.5 w-3.5" />
                  Generate
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Subscribed Events</p>
            <div className="grid gap-2 md:grid-cols-2">
              {ALL_EVENTS.map((eventItem) => {
                const checked = detailEvents.includes(eventItem.name)
                return (
                  <label
                    key={eventItem.name}
                    className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleEvent(eventItem.name, detailEvents, setDetailEvents)}
                      className="mt-0.5"
                    />
                    <span className="text-sm text-gray-700">
                      <span className="font-medium">{eventItem.name}</span>
                      <span className="block text-xs text-gray-500">{eventItem.description}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="webhook-enabled-checkbox"
              type="checkbox"
              checked={detailEnabled}
              onChange={(event) => setDetailEnabled(event.target.checked)}
            />
            <label htmlFor="webhook-enabled-checkbox" className="text-sm text-gray-700">
              Webhook enabled
            </label>
          </div>

          <div className="space-y-3 border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-medium text-gray-700">Delivery Logs</h5>
              <p className="text-xs text-gray-500">
                {deliveries.length} total
              </p>
            </div>

            {deliveriesError && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {deliveriesError}
              </div>
            )}

            {loadingDeliveries ? (
              <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500">
                Loading deliveries...
              </div>
            ) : deliveries.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500">
                No deliveries yet.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[800px] divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                        <th className="px-3 py-2" />
                        <th className="px-3 py-2">Timestamp</th>
                        <th className="px-3 py-2">Event</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Response</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pagedDeliveries.map((delivery) => {
                        const expanded = Boolean(expandedDeliveries[delivery.id])
                        return (
                          <Fragment key={delivery.id}>
                            <tr>
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedDeliveries((current) => ({
                                      ...current,
                                      [delivery.id]: !current[delivery.id],
                                    }))
                                  }
                                  className="text-gray-500 hover:text-gray-700"
                                  aria-label="Toggle delivery details"
                                >
                                  {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </button>
                              </td>
                              <td className="px-3 py-2 text-gray-700">
                                {new Date(delivery.created_at).toLocaleString()}
                              </td>
                              <td className="px-3 py-2 font-mono text-xs text-gray-700">{delivery.event}</td>
                              <td className="px-3 py-2">{statusBadge(delivery)}</td>
                              <td className="px-3 py-2 text-gray-700">
                                {delivery.last_response_code ?? '—'}
                              </td>
                            </tr>
                            {expanded && (
                              <tr>
                                <td colSpan={5} className="bg-gray-50 px-3 py-3">
                                  <div className="grid gap-3 md:grid-cols-2">
                                    <div>
                                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                                        Payload
                                      </p>
                                      <pre className="max-h-56 overflow-auto rounded border bg-white p-2 text-xs text-gray-800">
                                        {JSON.stringify(delivery.payload ?? {}, null, 2)}
                                      </pre>
                                    </div>
                                    <div>
                                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                                        Response Body
                                      </p>
                                      <pre className="max-h-56 overflow-auto rounded border bg-white p-2 text-xs text-gray-800">
                                        {delivery.last_response_body || 'No response body.'}
                                      </pre>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDeliveryPage((page) => Math.max(1, page - 1))}
                    disabled={deliveryPage <= 1}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-gray-500">
                    Page {deliveryPage} / {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDeliveryPage((page) => Math.min(totalPages, page + 1))}
                    disabled={deliveryPage >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open)
          if (!open) resetAddForm()
        }}
      >
        <DialogContent className="max-w-2xl">
          <form onSubmit={onCreateWebhook} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Add Webhook</DialogTitle>
              <DialogDescription>
                Register an endpoint to receive signed webhook events.
              </DialogDescription>
            </DialogHeader>

            {createError && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {createError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Endpoint URL</label>
              <Input
                value={addUrl}
                onChange={(event) => setAddUrl(event.target.value)}
                placeholder="https://example.com/webhooks/ubtrippin"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Description</label>
              <Input
                value={addDescription}
                onChange={(event) => setAddDescription(event.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Signing Secret</label>
              <div className="flex items-center gap-2">
                <Input
                  value={addSecret}
                  onChange={(event) => setAddSecret(event.target.value)}
                  placeholder="Required"
                  required
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const generated = generateHexSecret()
                    setAddSecret(generated)
                  }}
                >
                  <WandSparkles className="mr-1.5 h-3.5 w-3.5" />
                  Generate
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => copySecret(addSecret)}
                  disabled={!addSecret}
                >
                  {copiedSecret ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Secret is shown once. Store it securely before submitting.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Events</p>
              <div className="grid gap-2 md:grid-cols-2">
                {ALL_EVENTS.map((eventItem) => {
                  const checked = addEvents.includes(eventItem.name)
                  return (
                    <label
                      key={eventItem.name}
                      className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleEvent(eventItem.name, addEvents, setAddEvents)}
                        className="mt-0.5"
                      />
                      <span className="text-sm text-gray-700">
                        <span className="font-medium">{eventItem.name}</span>
                        <span className="block text-xs text-gray-500">{eventItem.description}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating || reachedLimit}>
                {creating ? 'Creating...' : 'Create Webhook'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
