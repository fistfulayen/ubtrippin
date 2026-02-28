'use client'

import { useEffect } from 'react'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('Global app error:', error)
  }, [error])

  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Something went wrong</h1>
          <p className="mt-2 text-sm text-gray-600">
            An unexpected error occurred while loading this page.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-md bg-[#1e293b] px-4 py-2 text-sm font-medium text-white hover:bg-[#0f172a]"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
