'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus } from 'lucide-react'

export function AddSenderForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [label, setLabel] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const trimmedEmail = email.trim().toLowerCase()

    if (!trimmedEmail) {
      setError('Email is required')
      setLoading(false)
      return
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address')
      setLoading(false)
      return
    }

    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in')
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase.from('allowed_senders').insert({
      user_id: user.id,
      email: trimmedEmail,
      label: label.trim() || null,
      verified: false,
    })

    if (insertError) {
      if (insertError.code === '23505') {
        setError('This email is already in your allowed senders list')
      } else {
        setError(insertError.message)
      }
      setLoading(false)
      return
    }

    setEmail('')
    setLabel('')
    setLoading(false)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <div className="flex-1">
          <Input
            type="email"
            placeholder="your.email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="w-40">
          <Input
            type="text"
            placeholder="Label (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={loading}>
          <Plus className="mr-2 h-4 w-4" />
          {loading ? 'Adding...' : 'Add'}
        </Button>
      </div>

      <p className="text-xs text-gray-500">
        Add your email address(es) that you&apos;ll use to forward booking emails.
      </p>
    </form>
  )
}
