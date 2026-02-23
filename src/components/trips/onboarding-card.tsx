'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="ml-2 rounded p-1 hover:bg-[#f1f5f9] transition-colors"
      aria-label="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <Copy className="h-4 w-4 text-gray-500" />
      )}
    </button>
  )
}

export function OnboardingCard() {
  return (
    <div className="rounded-2xl border border-[#cbd5e1] bg-[#ffffff] p-8">
      <h2 className="text-2xl font-bold text-[#1e293b] mb-6">
        Welcome to UBTRIPPIN 🧳
      </h2>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Left column */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[#1e293b]">
            Add your bookings
          </h3>
          <p className="text-sm text-gray-600">
            Forward any booking confirmation to:
          </p>
          <div className="flex items-center rounded-lg bg-white border border-[#cbd5e1] px-4 py-2 shadow-sm">
            <code className="font-mono text-sm font-semibold text-[#4f46e5]">
              trips@ubtrippin.xyz
            </code>
            <CopyButton text="trips@ubtrippin.xyz" />
          </div>

          <div className="flex justify-center py-2">
            <Image
              src="/evelope_icon.png"
              alt="Email envelope"
              width={80}
              height={80}
              className="opacity-80"
            />
          </div>

          <p className="text-sm text-gray-600">
            Works with flights, hotels, trains, rental cars and more.
          </p>
          <p className="text-xs text-gray-500">
            💡 Make sure to add your email in{' '}
            <Link href="/settings" className="underline hover:text-[#1e293b]">
              Settings
            </Link>{' '}
            first.
          </p>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[#1e293b]">
            Connect your AI agent
          </h3>
          <p className="text-sm text-gray-600">
            If you use an AI assistant (OpenClaw, Claude, etc.):
          </p>

          <div className="flex items-center rounded-lg bg-white border border-[#cbd5e1] px-4 py-2 shadow-sm">
            <code className="font-mono text-sm font-semibold text-[#4f46e5]">
              npx clawhub install ubtrippin
            </code>
            <CopyButton text="npx clawhub install ubtrippin" />
          </div>

          <p className="text-sm text-gray-600">
            Then give your agent your API key from{' '}
            <Link href="/settings" className="underline hover:text-[#1e293b]">
              Settings
            </Link>
            .
          </p>

          <p className="text-xs text-gray-500">
            Your agent can read your trips, check itineraries, and help plan
            future travel.
          </p>

          <div className="pt-2">
            <Link href="/trips/new">
              <Button variant="outline" size="sm">
                Or create a trip manually
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
