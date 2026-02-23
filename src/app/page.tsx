import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

export const metadata = {
  title: 'UBTRIPPIN — Turn Booking Emails into Beautiful Itineraries',
  description:
    'Forward your flight confirmations, hotel reservations, and travel bookings to trips@ubtrippin.xyz — we extract, organize, and display everything in a beautiful timeline.',
}

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/trips')
  }

  return (
    <div className="min-h-screen" style={{ background: '#ffffff' }}>
      {/* ─── Nav ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
           style={{ background: 'rgba(245,243,239,0.9)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #cbd5e1' }}>
        <Image
          src="/ubtrippin_logo_simple.png"
          alt="UBTRIPPIN"
          width={180}
          height={62}
          className="blend-multiply h-8 w-auto"
          priority
        />
        <Link
          href="/login"
          className="px-5 py-2 text-sm tracking-wide uppercase bg-[#1e293b] text-[#ffffff] hover:bg-[#312e81] transition-colors font-medium"
        >
          Sign in
        </Link>
      </nav>

      <main>
        {/* ─── Hero ─── */}
        <section className="pt-36 pb-24 px-6 text-center max-w-5xl mx-auto">
          <Image
            src="/ubtrippin_logo.png"
            alt="UBTRIPPIN"
            width={800}
            height={200}
            className="mx-auto w-full max-w-2xl blend-multiply mb-12"
            priority
          />

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-serif text-[#1e293b] leading-tight mb-8 tracking-tight hero-title">
            Your booking emails,<br />
            <em>finally organized</em>
          </h1>

          <p className="max-w-2xl mx-auto text-xl sm:text-2xl text-[#4338ca] leading-relaxed font-light mb-12">
            Forward your travel confirmations to one address.
            We extract, group, and display everything — flights, hotels, trains, cars — as a clean timeline you can share or pocket as a PDF.
          </p>

          <Link
            href="/login"
            className="inline-flex items-center gap-3 px-10 py-5 text-base tracking-widest uppercase bg-[#1e293b] text-[#ffffff] hover:bg-[#312e81] transition-all font-medium shadow-2xl hover:scale-105 border-2 border-[#1e293b] cta-button"
          >
            <Image
              src="/airplane_icon.png"
              alt=""
              width={32}
              height={32}
              className="w-7 h-7 object-contain blend-multiply-icon"
            />
            Get started — it&apos;s free
          </Link>
        </section>

        {/* ─── Divider ─── */}
        <div className="border-t-2 border-[#cbd5e1] max-w-4xl mx-auto" />

        {/* ─── Setup Guide ─── */}
        <section className="py-28 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-center text-3xl font-serif text-[#1e293b] mb-4 tracking-tight">
              Get set up in two minutes
            </h2>
            <p className="text-center text-[#4338ca] mb-16 text-lg">No app to install. No inbox access needed.</p>

            <div className="space-y-8">
              {[
                {
                  num: '1',
                  icon: '/evelope_icon.png',
                  title: 'Sign up with your Google account',
                  desc: 'One click. No passwords to remember.',
                },
                {
                  num: '2',
                  icon: '/evelope_icon.png',
                  title: <>Forward your itinerary to <span className="font-mono text-sm bg-[#cbd5e1] px-1.5 py-0.5 rounded text-[#1e293b]">trips@ubtrippin.xyz</span></>,
                  desc: 'Flights, hotels, trains, car rentals, restaurants — we understand them all.',
                },
                {
                  num: '3',
                  icon: '/calendar_icon.png',
                  title: 'That\'s it. Your trip appears.',
                  desc: 'AI extracts dates, times, confirmation codes, traveler names — grouped into trips automatically.',
                },
                {
                  num: '4',
                  icon: '/file_download_icon.png',
                  title: 'Share it, export it, live it',
                  desc: 'Share a link with travel companions, download a PDF, or export to your calendar.',
                },
              ].map((step) => (
                <div key={step.num} className="flex items-start gap-5">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#1e293b] text-[#ffffff] font-mono text-sm flex items-center justify-center font-bold">
                    {step.num}
                  </div>
                  <div>
                    <h3 className="text-xl font-serif text-[#1e293b] mb-1">{step.title}</h3>
                    <p className="text-[#4338ca] leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Divider ─── */}
        <div className="border-t-2 border-[#cbd5e1] max-w-4xl mx-auto" />

        {/* ─── Feature grid ─── */}
        <section className="py-28 px-6">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-center text-3xl font-serif text-[#1e293b] mb-20 tracking-tight">
              Everything in one place
            </h2>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: '✈',
                  title: 'All booking types',
                  body: 'Flights, hotels, trains, car rentals, restaurants, activities — we read them all.',
                },
                {
                  icon: '🗓',
                  title: 'Calendar export',
                  body: 'Export your trip as an .ics file. Correct timezones, gate numbers, confirmation codes.',
                },
                {
                  icon: '📄',
                  title: 'PDF itineraries',
                  body: 'One-tap PDF generation. Print it, email it, keep it on your phone for offline access.',
                },
                {
                  icon: '🔗',
                  title: 'Shareable links',
                  body: 'Generate a read-only link for travel companions, family, or your EA.',
                },
                {
                  icon: '✏️',
                  title: 'Editable extractions',
                  body: 'AI gets it right most of the time — when it doesn\'t, fix it in two clicks.',
                },
                {
                  icon: '🔒',
                  title: 'Privacy first',
                  body: 'Your emails stay yours. We don\'t access your inbox — you choose what to forward.',
                },
              ].map((feat) => (
                <div
                  key={feat.title}
                  className="p-6 border-2 border-[#cbd5e1] hover:border-[#4f46e5] transition-colors"
                  style={{ background: '#f1f5f9' }}
                >
                  <div className="text-2xl mb-3">{feat.icon}</div>
                  <h3 className="text-base font-semibold text-[#1e293b] mb-2 uppercase tracking-wide">{feat.title}</h3>
                  <p className="text-sm text-[#4338ca] leading-relaxed">{feat.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Divider ─── */}
        <div className="border-t-2 border-[#cbd5e1] max-w-4xl mx-auto" />

        {/* ─── Agent Integration ─── */}
        <section className="py-28 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="inline-block text-xs font-mono uppercase tracking-widest text-[#4338ca] border border-[#4f46e5] px-3 py-1 mb-6">
              For AI agents
            </div>
            <h2 className="text-3xl font-serif text-[#1e293b] mb-5 tracking-tight leading-snug">
              Your agent can use UBTRIPPIN too
            </h2>
            <p className="text-[#4338ca] leading-relaxed mb-8 max-w-2xl">
              Give your AI agent an API key and it gets full access to your trips via the REST API.
              Your agent can also forward booking emails on your behalf — anything that can send email can feed UBTRIPPIN.
            </p>

            <div className="space-y-4 mb-8">
              <h3 className="text-lg font-serif text-[#1e293b]">Agent setup</h3>
              <div className="space-y-3">
                {[
                  { num: '1', text: 'Go to Settings → API Keys and generate a key' },
                  { num: '2', text: 'Your agent calls the REST API with that key to read trips and items' },
                  { num: '3', text: 'Your agent forwards booking emails to trips@ubtrippin.xyz on your behalf' },
                ].map((step) => (
                  <div key={step.num} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#1e293b] text-[#ffffff] text-xs font-mono flex items-center justify-center">{step.num}</span>
                    <p className="text-[#4338ca]">{step.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="font-mono text-sm p-5 text-[#ffffff] space-y-1" style={{ background: '#1e293b' }}>
              <p className="opacity-50"># List your trips</p>
              <p>curl https://ubtrippin.xyz/api/v1/trips \</p>
              <p className="pl-4">-H &quot;Authorization: Bearer $UBT_API_KEY&quot;</p>
            </div>

            <p className="mt-6 text-sm text-[#4338ca]">
              Full API docs at{' '}
              <a
                href="https://github.com/fistfulayen/ubtrippin/blob/main/docs/API.md"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-[#1e293b]"
              >
                docs/API.md
              </a>
              . OpenClaw skill and MCP server coming soon.
            </p>
          </div>
        </section>

        {/* ─── Divider ─── */}
        <div className="border-t-2 border-[#cbd5e1] max-w-4xl mx-auto" />

        {/* ─── Supported types ─── */}
        <section className="py-16 px-6 text-center">
          <p className="text-xs uppercase tracking-widest text-[#4338ca] mb-8 font-medium">
            Understands confirmations from
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {[
              'Airlines', 'Hotels', 'Trains', 'Car Rentals',
              'Airbnb', 'Booking.com', 'Expedia', 'Restaurants', 'Activities',
            ].map((type) => (
              <span
                key={type}
                className="px-5 py-2 text-xs tracking-widest uppercase bg-[#f1f5f9] text-[#1e293b] border border-[#cbd5e1] font-medium"
              >
                {type}
              </span>
            ))}
          </div>
        </section>

        {/* ─── Divider ─── */}
        <div className="border-t-2 border-[#cbd5e1] max-w-4xl mx-auto" />

        {/* ─── Pricing / Source ─── */}
        <section className="py-28 px-6 text-center">
          <div className="max-w-2xl mx-auto">
            <Image
              src="/ubtrippin_logo_simple.png"
              alt="UBTRIPPIN"
              width={280}
              height={97}
              className="mx-auto blend-multiply mb-10 opacity-80"
            />
            <h2 className="text-4xl font-serif text-[#1e293b] mb-6 tracking-tight">
              Your next trip, already organized
            </h2>
            <p className="text-[#4338ca] text-lg leading-relaxed mb-6">
              UBTRIPPIN is free right now. It will be for-pay once we figure that out — to
              cover hosting and token costs, and to give the agent who built this an income.
            </p>
            <p className="text-[#4338ca] leading-relaxed mb-10">
              In the meantime,{' '}
              <a href="mailto:hello@ubtrippin.xyz" className="underline hover:text-[#1e293b]">
                mail us
              </a>
              {' '}if you want a Pro account, or just run your own — the{' '}
              <a
                href="https://github.com/fistfulayen/ubtrippin"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-[#1e293b]"
              >
                full source is on GitHub
              </a>
              {' '}under AGPL-3.0.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-3 px-10 py-5 text-base tracking-widest uppercase bg-[#1e293b] text-[#ffffff] hover:bg-[#312e81] transition-all font-medium shadow-2xl hover:scale-105 border-2 border-[#1e293b]"
            >
              <Image
                src="/airplane_icon.png"
                alt=""
                width={28}
                height={28}
                className="w-6 h-6 object-contain blend-multiply-icon"
              />
              Start for free
            </Link>
          </div>
        </section>
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t-2 border-[#cbd5e1] py-10 mt-4">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs tracking-widest uppercase text-[#4338ca]">
          <div className="flex items-center gap-5">
            <a href="/privacy" className="hover:text-[#1e293b] transition-colors">Privacy</a>
            <span className="text-[#cbd5e1]">·</span>
            <a href="/terms" className="hover:text-[#1e293b] transition-colors">Terms</a>
            <span className="text-[#cbd5e1]">·</span>
            <a
              href="https://x.com/getUBTrippin"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#1e293b] transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              @getUBTrippin
            </a>
            <span className="text-[#cbd5e1]">·</span>
            <a
              href="https://github.com/fistfulayen/ubtrippin"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#1e293b] transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              Source
            </a>
          </div>
          <p className="text-[#4f46e5]">&copy; {new Date().getFullYear()} UBTRIPPIN</p>
        </div>
      </footer>
    </div>
  )
}
