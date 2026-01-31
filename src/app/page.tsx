import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

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
            <Image
              src="/ubtrippin_logo.png"
              alt="UBTRIPPIN"
              width={160}
              height={40}
              className="h-10 w-auto"
            />
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
            Forward your flight confirmations, hotel reservations, and travel bookings and we&apos;ll
            organize everything into a clean timeline you can share or download.
          </p>
          <div className="mt-10">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-6 py-3 text-lg font-medium text-white hover:bg-amber-700 transition-colors shadow-lg shadow-amber-500/25"
            >
              <Image
                src="/airplane_icon.png"
                alt=""
                width={20}
                height={20}
                className="h-5 w-5"
              />
              Get started
            </Link>
          </div>
        </div>

        {/* How it works */}
        <div className="mt-24">
          <h2 className="text-center text-2xl font-bold text-gray-900">
            How it works
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-amber-100">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100">
                <Image
                  src="/evelope_icon.png"
                  alt=""
                  width={24}
                  height={24}
                  className="h-6 w-6"
                />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">
                Forward your emails
              </h3>
              <p className="mt-2 text-gray-600">
                Send your booking confirmations to your dedicated email address. We accept flights,
                hotels, trains, car rentals, and more.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm border border-amber-100">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100">
                <Image
                  src="/calendar_icon.png"
                  alt=""
                  width={24}
                  height={24}
                  className="h-6 w-6"
                />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">
                AI organizes everything
              </h3>
              <p className="mt-2 text-gray-600">
                Our AI extracts key details like dates, times, confirmation codes, and automatically groups them into trips.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm border border-amber-100">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100">
                <Image
                  src="/file_download_icon.png"
                  alt=""
                  width={24}
                  height={24}
                  className="h-6 w-6"
                />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">
                View & download
              </h3>
              <p className="mt-2 text-gray-600">
                Access your trips anytime with a beautiful timeline view. Download PDF itineraries to share or print.
              </p>
            </div>
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
