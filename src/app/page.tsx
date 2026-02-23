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
    <div className="min-h-screen" style={{ background: '#ede6cf' }}>
      {/* ─── Nav ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
           style={{ background: 'rgba(237,230,207,0.9)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #d4c9b0' }}>
        <Image
          src="/ubtrippin_logo_simple.png"
          alt="UBTRIPPIN"
          width={180}
          height={62}
          className="blend-multiply h-8 w-auto"
          priority
        />
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/fistfulayen/ubtrippin"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 text-sm text-[#544836] hover:text-[#2a2419] transition-colors tracking-wide"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            Open source
          </a>
          <Link
            href="/login"
            className="px-5 py-2 text-sm tracking-wide uppercase bg-[#2a2419] text-[#ede6cf] hover:bg-[#3d3429] transition-colors font-medium"
          >
            Sign in
          </Link>
        </div>
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

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-serif text-[#2a2419] leading-tight mb-8 tracking-tight hero-title">
            Your booking emails,<br />
            <em>finally organized</em>
          </h1>

          <p className="max-w-2xl mx-auto text-xl sm:text-2xl text-[#544836] leading-relaxed font-light mb-4">
            Forward your travel confirmations to one address.
            We extract, group, and display everything — flights, hotels, trains, cars — as a clean timeline you can share or pocket as a PDF.
          </p>

          {/* The email address — CLI-chic hero element */}
          <div className="inline-flex items-center gap-3 mt-6 mb-10 px-6 py-3 bg-[#2a2419] text-[#ede6cf] font-mono text-lg tracking-wider shadow-lg">
            <span className="opacity-50 text-sm">$</span>
            <span>trips@ubtrippin.xyz</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-3 px-10 py-5 text-base tracking-widest uppercase bg-[#2a2419] text-[#ede6cf] hover:bg-[#3d3429] transition-all font-medium shadow-2xl hover:scale-105 border-2 border-[#2a2419] cta-button"
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
            <a
              href="https://github.com/fistfulayen/ubtrippin"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-5 text-base tracking-widest uppercase text-[#544836] hover:text-[#2a2419] border-2 border-[#a89878] hover:border-[#544836] transition-all font-medium"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              View source
            </a>
          </div>
        </section>

        {/* ─── Divider ─── */}
        <div className="border-t-2 border-[#d4c9b0] max-w-4xl mx-auto" />

        {/* ─── How it works ─── */}
        <section className="py-28 px-6">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-center text-3xl font-serif text-[#2a2419] mb-4 tracking-tight">
              How it works
            </h2>
            <p className="text-center text-[#544836] mb-20 text-lg">Three steps. No app to install. No inbox access needed.</p>

            <div className="grid gap-16 md:grid-cols-3">
              {/* Step 1 */}
              <div className="text-center feature-step">
                <div className="relative inline-flex mb-8">
                  <span className="absolute -top-3 -left-3 w-7 h-7 rounded-full bg-[#2a2419] text-[#ede6cf] text-xs font-mono flex items-center justify-center font-bold">1</span>
                  <Image
                    src="/evelope_icon.png"
                    alt=""
                    width={120}
                    height={120}
                    className="w-28 h-28 object-contain blend-multiply"
                  />
                </div>
                <h3 className="text-xl font-serif text-[#2a2419] mb-3">Forward your confirmations</h3>
                <p className="text-[#544836] leading-relaxed">
                  Send booking emails to{' '}
                  <span className="font-mono text-sm bg-[#d4c9b0] px-1.5 py-0.5 rounded text-[#2a2419] whitespace-nowrap">
                    trips@ubtrippin.xyz
                  </span>
                  {' '}— flights, hotels, trains, car rentals, restaurants.
                </p>
              </div>

              {/* Step 2 */}
              <div className="text-center feature-step">
                <div className="relative inline-flex mb-8">
                  <span className="absolute -top-3 -left-3 w-7 h-7 rounded-full bg-[#2a2419] text-[#ede6cf] text-xs font-mono flex items-center justify-center font-bold">2</span>
                  <Image
                    src="/calendar_icon.png"
                    alt=""
                    width={120}
                    height={120}
                    className="w-28 h-28 object-contain blend-multiply"
                  />
                </div>
                <h3 className="text-xl font-serif text-[#2a2419] mb-3">AI extracts everything</h3>
                <p className="text-[#544836] leading-relaxed">
                  Dates, times, confirmation codes, addresses, passenger names — all pulled out and
                  grouped into trips automatically. No manual entry.
                </p>
              </div>

              {/* Step 3 */}
              <div className="text-center feature-step">
                <div className="relative inline-flex mb-8">
                  <span className="absolute -top-3 -left-3 w-7 h-7 rounded-full bg-[#2a2419] text-[#ede6cf] text-xs font-mono flex items-center justify-center font-bold">3</span>
                  <Image
                    src="/file_download_icon.png"
                    alt=""
                    width={120}
                    height={120}
                    className="w-28 h-28 object-contain blend-multiply"
                  />
                </div>
                <h3 className="text-xl font-serif text-[#2a2419] mb-3">View, share, download</h3>
                <p className="text-[#544836] leading-relaxed">
                  A beautiful timeline of every booking. Share a link with travel companions or
                  download a PDF to keep offline.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Divider ─── */}
        <div className="border-t-2 border-[#d4c9b0] max-w-4xl mx-auto" />

        {/* ─── Feature grid ─── */}
        <section className="py-28 px-6">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-center text-3xl font-serif text-[#2a2419] mb-20 tracking-tight">
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
                  body: 'Export your trip as an .ics file to import into any calendar app.',
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
                  className="p-6 border-2 border-[#d4c9b0] hover:border-[#a89878] transition-colors"
                  style={{ background: '#ebe1cb' }}
                >
                  <div className="text-2xl mb-3">{feat.icon}</div>
                  <h3 className="text-base font-semibold text-[#2a2419] mb-2 uppercase tracking-wide">{feat.title}</h3>
                  <p className="text-sm text-[#544836] leading-relaxed">{feat.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Divider ─── */}
        <div className="border-t-2 border-[#d4c9b0] max-w-4xl mx-auto" />

        {/* ─── Agent / OSS section ─── */}
        <section className="py-28 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="grid gap-12 md:grid-cols-2 items-center">
              {/* Left: agent-friendly */}
              <div>
                <div className="inline-block text-xs font-mono uppercase tracking-widest text-[#544836] border border-[#a89878] px-3 py-1 mb-6">
                  Agent-friendly
                </div>
                <h2 className="text-3xl font-serif text-[#2a2419] mb-5 tracking-tight leading-snug">
                  Works with any email client — including AI agents
                </h2>
                <p className="text-[#544836] leading-relaxed mb-6">
                  The interface is just email. Your AI assistant, your booking automation,
                  your inbox rules — anything that can forward an email can feed UB Trippin.
                  No API key required.
                </p>
                <div className="space-y-2">
                  {[
                    '$ forward booking-confirmation.eml trips@ubtrippin.xyz',
                    '# That\'s it. Your trip appears.',
                  ].map((line, i) => (
                    <div
                      key={i}
                      className="font-mono text-sm px-4 py-2.5 text-[#ede6cf]"
                      style={{ background: '#2a2419' }}
                    >
                      <span className={i === 1 ? 'opacity-50' : ''}>{line}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: open source */}
              <div>
                <div className="inline-block text-xs font-mono uppercase tracking-widest text-[#544836] border border-[#a89878] px-3 py-1 mb-6">
                  Open source
                </div>
                <h2 className="text-3xl font-serif text-[#2a2419] mb-5 tracking-tight leading-snug">
                  Use ours or run your own
                </h2>
                <p className="text-[#544836] leading-relaxed mb-6">
                  The full source is on GitHub under AGPL-3.0. Self-host it, fork it,
                  audit it. We use the same code in production — no hidden magic.
                </p>
                <a
                  href="https://github.com/fistfulayen/ubtrippin"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 px-6 py-3 border-2 border-[#2a2419] text-[#2a2419] hover:bg-[#2a2419] hover:text-[#ede6cf] transition-all text-sm tracking-widest uppercase font-medium"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  fistfulayen/ubtrippin
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Divider ─── */}
        <div className="border-t-2 border-[#d4c9b0] max-w-4xl mx-auto" />

        {/* ─── Supported types ─── */}
        <section className="py-16 px-6 text-center">
          <p className="text-xs uppercase tracking-widest text-[#544836] mb-8 font-medium">
            Understands confirmations from
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {[
              'Airlines', 'Hotels', 'Trains', 'Car Rentals',
              'Airbnb', 'Booking.com', 'Expedia', 'Restaurants', 'Activities',
            ].map((type) => (
              <span
                key={type}
                className="px-5 py-2 text-xs tracking-widest uppercase bg-[#ebe1cb] text-[#2a2419] border border-[#d4c9b0] font-medium"
              >
                {type}
              </span>
            ))}
          </div>
        </section>

        {/* ─── Divider ─── */}
        <div className="border-t-2 border-[#d4c9b0] max-w-4xl mx-auto" />

        {/* ─── Final CTA ─── */}
        <section className="py-28 px-6 text-center">
          <div className="max-w-2xl mx-auto">
            <Image
              src="/ubtrippin_logo_simple.png"
              alt="UBTRIPPIN"
              width={280}
              height={97}
              className="mx-auto blend-multiply mb-10 opacity-80"
            />
            <h2 className="text-4xl font-serif text-[#2a2419] mb-6 tracking-tight">
              Your next trip, already organized
            </h2>
            <p className="text-[#544836] text-lg leading-relaxed mb-10">
              Sign up free. Forward your first confirmation.
              See your itinerary in seconds.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-3 px-10 py-5 text-base tracking-widest uppercase bg-[#2a2419] text-[#ede6cf] hover:bg-[#3d3429] transition-all font-medium shadow-2xl hover:scale-105 border-2 border-[#2a2419]"
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
      <footer className="border-t-2 border-[#d4c9b0] py-10 mt-4">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs tracking-widest uppercase text-[#544836]">
          <div className="flex items-center gap-5">
            <a href="/privacy" className="hover:text-[#2a2419] transition-colors">Privacy</a>
            <span className="text-[#d4c9b0]">·</span>
            <a href="/terms" className="hover:text-[#2a2419] transition-colors">Terms</a>
            <span className="text-[#d4c9b0]">·</span>
            <a
              href="https://github.com/fistfulayen/ubtrippin"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#2a2419] transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              GitHub
            </a>
          </div>
          <p className="text-[#a89878]">&copy; {new Date().getFullYear()} UBTRIPPIN · AGPL-3.0</p>
        </div>
      </footer>
    </div>
  )
}
