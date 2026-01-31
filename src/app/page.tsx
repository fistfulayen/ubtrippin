import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plane, Mail, Calendar, FileDown } from 'lucide-react'

export default async function HomePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If logged in, redirect to trips
  if (user) {
    redirect('/trips')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50">
      {/* Header */}
      <header className="border-b border-amber-200/50 bg-white/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold tracking-tight text-gray-900">
              UBTRIPPIN
            </span>
            <Link
              href="/login"
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
            <span className="block">Turn your booking emails</span>
            <span className="block text-amber-600">into beautiful itineraries</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
            Forward your flight confirmations, hotel reservations, and travel bookings to{' '}
            <strong className="text-gray-900">trips@ubtrippin.xyz</strong> and we&apos;ll
            organize everything into a clean timeline you can share or download.
          </p>
          <div className="mt-10">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-6 py-3 text-lg font-medium text-white hover:bg-amber-700 transition-colors shadow-lg shadow-amber-500/25"
            >
              <Plane className="h-5 w-5" />
              Get started free
            </Link>
          </div>
        </div>

        {/* How it works */}
        <div className="mt-24">
          <h2 className="text-center text-2xl font-bold text-gray-900">
            How it works
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              {
                icon: Mail,
                title: 'Forward your emails',
                description:
                  'Send your booking confirmations to trips@ubtrippin.xyz. We accept flights, hotels, trains, car rentals, and more.',
              },
              {
                icon: Calendar,
                title: 'AI organizes everything',
                description:
                  'Our AI extracts key details like dates, times, confirmation codes, and automatically groups them into trips.',
              },
              {
                icon: FileDown,
                title: 'View & download',
                description:
                  'Access your trips anytime with a beautiful timeline view. Download PDF itineraries to share or print.',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl bg-white p-6 shadow-sm border border-amber-100"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Supported */}
        <div className="mt-24 text-center">
          <h2 className="text-xl font-semibold text-gray-900">
            Supports all major booking types
          </h2>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            {['Flights', 'Hotels', 'Trains', 'Car Rentals', 'Restaurants', 'Activities'].map(
              (type) => (
                <span
                  key={type}
                  className="rounded-full bg-amber-100 px-4 py-2 text-sm font-medium text-amber-800"
                >
                  {type}
                </span>
              )
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-amber-200/50 bg-white/50 py-8 mt-24">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} UBTRIPPIN. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
