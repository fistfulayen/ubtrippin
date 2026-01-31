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
    <div className="min-h-screen bg-gradient-to-br from-[#fffbf5] via-amber-50/30 to-orange-50/40">
      {/* Floating Sign In */}
      <div className="fixed top-6 right-6 z-50">
        <Link
          href="/login"
          className="rounded-full bg-white/90 backdrop-blur-sm px-6 py-2.5 text-sm font-medium text-amber-900 hover:bg-white transition-all shadow-lg shadow-amber-900/5 border border-amber-100/50"
        >
          Sign in
        </Link>
      </div>

      {/* Hero */}
      <main className="mx-auto max-w-5xl px-6 py-20 sm:py-32">
        {/* Logo - BIG and CENTERED */}
        <div className="text-center mb-16 logo-hero">
          <Image
            src="/ubtrippin_logo.png"
            alt="UBTRIPPIN"
            width={480}
            height={120}
            className="mx-auto w-full max-w-md sm:max-w-lg"
            priority
          />
        </div>

        {/* Headline */}
        <div className="text-center mb-20">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light tracking-tight text-gray-900 leading-tight mb-6">
            Turn your booking emails<br />
            <span className="text-amber-700 font-normal">into beautiful itineraries</span>
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg sm:text-xl text-gray-600 leading-relaxed font-light">
            Forward your flight confirmations, hotel reservations, and travel bookings—we&apos;ll
            organize everything into a clean timeline you can share or download.
          </p>
          <div className="mt-12">
            <Link
              href="/login"
              className="inline-flex items-center gap-3 rounded-full bg-amber-600 px-8 py-4 text-lg font-medium text-white hover:bg-amber-700 transition-all shadow-xl shadow-amber-600/25 hover:shadow-2xl hover:shadow-amber-600/30 hover:scale-105 cta-button"
            >
              <Image
                src="/airplane_icon.png"
                alt=""
                width={24}
                height={24}
                className="w-6 h-6 icon-tint-white"
              />
              Get started
            </Link>
          </div>
        </div>

        {/* How it works */}
        <div className="mt-32">
          <h2 className="text-center text-3xl font-light text-gray-900 mb-16">
            How it works
          </h2>
          <div className="grid gap-12 md:grid-cols-3">
            {/* Step 1 */}
            <div className="text-center feature-card">
              <div className="inline-flex mb-6">
                <Image
                  src="/evelope_icon.png"
                  alt=""
                  width={72}
                  height={72}
                  className="w-16 h-16 sm:w-18 sm:h-18 icon-tint-amber"
                />
              </div>
              <h3 className="text-xl font-medium text-gray-900 mb-3">
                Forward your emails
              </h3>
              <p className="text-gray-600 leading-relaxed font-light">
                Send your booking confirmations to your dedicated email address. We accept flights,
                hotels, trains, car rentals, and more.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center feature-card">
              <div className="inline-flex mb-6">
                <Image
                  src="/calendar_icon.png"
                  alt=""
                  width={72}
                  height={72}
                  className="w-16 h-16 sm:w-18 sm:h-18 icon-tint-amber"
                />
              </div>
              <h3 className="text-xl font-medium text-gray-900 mb-3">
                AI organizes everything
              </h3>
              <p className="text-gray-600 leading-relaxed font-light">
                Our AI extracts key details like dates, times, confirmation codes, and automatically groups them into trips.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center feature-card">
              <div className="inline-flex mb-6">
                <Image
                  src="/file_download_icon.png"
                  alt=""
                  width={72}
                  height={72}
                  className="w-16 h-16 sm:w-18 sm:h-18 icon-tint-amber"
                />
              </div>
              <h3 className="text-xl font-medium text-gray-900 mb-3">
                View & download
              </h3>
              <p className="text-gray-600 leading-relaxed font-light">
                Access your trips anytime with a beautiful timeline view. Download PDF itineraries to share or print.
              </p>
            </div>
          </div>
        </div>

        {/* Supported booking types */}
        <div className="mt-32 text-center">
          <h2 className="text-xl font-light text-gray-700 mb-8">
            Supports all major booking types
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {['Flights', 'Hotels', 'Trains', 'Car Rentals', 'Restaurants', 'Activities'].map(
              (type) => (
                <span
                  key={type}
                  className="rounded-full bg-amber-100/60 px-5 py-2 text-sm font-light text-amber-900 border border-amber-200/50 booking-tag"
                >
                  {type}
                </span>
              )
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-amber-200/30 py-12 mt-32">
        <div className="mx-auto max-w-7xl px-6 text-center text-sm text-gray-500 font-light">
          <p>&copy; {new Date().getFullYear()} UBTRIPPIN. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
