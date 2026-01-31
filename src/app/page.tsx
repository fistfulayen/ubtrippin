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
    <div className="min-h-screen" style={{ background: '#f4ead5' }}>
      {/* Header with Logo and Sign In */}
      <header className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between">
          <Image
            src="/ubtrippin_logo.png"
            alt="UBTRIPPIN"
            width={400}
            height={100}
            className="w-auto h-20 sm:h-24"
            priority
          />
          <Link
            href="/login"
            className="px-6 py-2.5 text-sm tracking-wide uppercase bg-[#2a2419] text-[#f4ead5] hover:bg-[#3d3429] transition-colors border-2 border-[#2a2419] font-medium"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-6 py-16 sm:py-24">
        <div className="text-center mb-24">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-serif text-[#2a2419] leading-tight mb-8 tracking-tight hero-title">
            Turn your booking emails<br />
            into beautiful itineraries
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-xl sm:text-2xl text-[#544836] leading-relaxed font-light">
            Forward your flight confirmations, hotel reservations, and travel bookings—we&apos;ll
            organize everything into a clean timeline you can share or download.
          </p>
          <div className="mt-14">
            <Link
              href="/login"
              className="inline-flex items-center gap-4 px-10 py-5 text-lg tracking-wide uppercase bg-[#2a2419] text-[#f4ead5] hover:bg-[#3d3429] transition-all font-medium shadow-2xl hover:shadow-3xl hover:scale-105 border-2 border-[#2a2419]"
            >
              <Image
                src="/airplane_icon.png"
                alt=""
                width={32}
                height={32}
                className="w-8 h-8 object-contain"
              />
              Get started
            </Link>
          </div>
        </div>

        {/* How it works */}
        <div className="mt-40">
          <h2 className="text-center text-4xl font-serif text-[#2a2419] mb-20 tracking-tight">
            How it works
          </h2>
          <div className="grid gap-16 md:grid-cols-3">
            {/* Step 1 */}
            <div className="text-center feature-step">
              <div className="inline-flex mb-8">
                <Image
                  src="/evelope_icon.png"
                  alt=""
                  width={120}
                  height={120}
                  className="w-28 h-28 object-contain"
                />
              </div>
              <h3 className="text-2xl font-serif text-[#2a2419] mb-4">
                Forward your emails
              </h3>
              <p className="text-[#544836] leading-relaxed text-lg">
                Send your booking confirmations to your dedicated email address. We accept flights,
                hotels, trains, car rentals, and more.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center feature-step">
              <div className="inline-flex mb-8">
                <Image
                  src="/calendar_icon.png"
                  alt=""
                  width={120}
                  height={120}
                  className="w-28 h-28 object-contain"
                />
              </div>
              <h3 className="text-2xl font-serif text-[#2a2419] mb-4">
                AI organizes everything
              </h3>
              <p className="text-[#544836] leading-relaxed text-lg">
                Our AI extracts key details like dates, times, confirmation codes, and automatically groups them into trips.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center feature-step">
              <div className="inline-flex mb-8">
                <Image
                  src="/file_download_icon.png"
                  alt=""
                  width={120}
                  height={120}
                  className="w-28 h-28 object-contain"
                />
              </div>
              <h3 className="text-2xl font-serif text-[#2a2419] mb-4">
                View & download
              </h3>
              <p className="text-[#544836] leading-relaxed text-lg">
                Access your trips anytime with a beautiful timeline view. Download PDF itineraries to share or print.
              </p>
            </div>
          </div>
        </div>

        {/* Supported booking types */}
        <div className="mt-40 text-center">
          <h2 className="text-xl uppercase tracking-widest text-[#544836] mb-10 font-medium">
            Supports all major booking types
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {['Flights', 'Hotels', 'Trains', 'Car Rentals', 'Restaurants', 'Activities'].map(
              (type) => (
                <span
                  key={type}
                  className="px-6 py-2.5 text-sm tracking-wide uppercase bg-[#ebe1cb] text-[#2a2419] border border-[#d4c9b0] font-medium"
                >
                  {type}
                </span>
              )
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-[#d4c9b0] py-12 mt-32">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm tracking-wide uppercase text-[#544836]">
          <p>&copy; {new Date().getFullYear()} UBTRIPPIN. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
