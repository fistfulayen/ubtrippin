'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, Copy, Check, Key, AlertTriangle } from 'lucide-react'

interface ApiKey {
  id: string
  name: string
  key_preview: string
  created_at: string
  last_used_at: string | null
}

export function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [newKeyName, setNewKeyName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [newPlaintext, setNewPlaintext] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchKeys = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/keys')
      const data = await res.json()
      if (res.ok) setKeys(data.keys ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchKeys()
  }, [fetchKeys])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newKeyName.trim()
    if (!name) return

    setCreating(true)
    setCreateError(null)
    setNewPlaintext(null)

    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()

      if (!res.ok) {
        setCreateError(data.error ?? 'Failed to create key')
        return
      }

      setNewPlaintext(data.plaintext)
      setNewKeyName('')
      // Add the new key to the list without refetching
      setKeys((prev) => [data.key, ...prev])
    } catch {
      setCreateError('Network error — please try again')
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = async () => {
    if (!newPlaintext) return
    await navigator.clipboard.writeText(newPlaintext)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handleDelete = async (id: string) => {
    setDeleting(id)
    try {
      const res = await fetch(`/api/keys?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setKeys((prev) => prev.filter((k) => k.id !== id))
        // If the deleted key was the one we just showed, clear it
        if (newPlaintext) setNewPlaintext(null)
      }
    } finally {
      setDeleting(null)
    }
  }

  const dismissNewKey = () => {
    setNewPlaintext(null)
    setCopied(false)
  }

  return (
    <div className="space-y-6">
      {/* Create new key form */}
      <form onSubmit={handleCreate} className="space-y-3">
        {createError && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {createError}
          </div>
        )}

        <div className="flex gap-3">
          <Input
            type="text"
            placeholder="Key name (e.g. My Agent, CI/CD)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            className="flex-1"
            required
          />
          <Button type="submit" disabled={creating || !newKeyName.trim()}>
            <Plus className="mr-2 h-4 w-4" />
            {creating ? 'Generating…' : 'Generate Key'}
          </Button>
        </div>
      </form>

      {/* One-time key reveal */}
      {newPlaintext && (
        <div className="rounded-lg border border-[#c7c2b8] bg-[#f5f3ef] p-4 space-y-3">
          <div className="flex items-start gap-2 text-[#1e1b4b]">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-[#b45309]" />
            <p className="text-sm font-medium">
              Save this key — you won&apos;t see it again. Copy it now and store it somewhere safe.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-white border border-[#c7c2b8] px-3 py-2 text-sm font-mono text-gray-800 select-all overflow-x-auto">
              {newPlaintext}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="shrink-0 text-[#92400e] hover:text-[#1e1b4b] hover:bg-[#eceae4]"
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              <span className="ml-1.5">{copied ? 'Copied!' : 'Copy'}</span>
            </Button>
          </div>
          <button
            type="button"
            onClick={dismissNewKey}
            className="text-xs text-[#b45309] hover:text-[#1e1b4b] underline underline-offset-2"
          >
            I&apos;ve saved it — dismiss
          </button>
        </div>
      )}

      {/* Keys list */}
      {loading ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center">
          <p className="text-sm text-gray-500">Loading keys…</p>
        </div>
      ) : keys.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center">
          <Key className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-2 text-sm text-gray-600">
            No API keys yet. Generate one above.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Your API keys</h4>
          <div className="divide-y divide-gray-100 rounded-lg border">
            {keys.map((apiKey) => (
              <div
                key={apiKey.id}
                className="flex items-center justify-between gap-4 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 truncate">
                      {apiKey.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <code className="text-xs text-gray-500 font-mono">
                      {apiKey.key_preview}
                    </code>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-400">
                      Created {new Date(apiKey.created_at).toLocaleDateString()}
                    </span>
                    {apiKey.last_used_at && (
                      <>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-400">
                          Last used {new Date(apiKey.last_used_at).toLocaleDateString()}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(apiKey.id)}
                  disabled={deleting === apiKey.id}
                  className="text-gray-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
