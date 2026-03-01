import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { AgentTabs } from '@/components/agent-tabs'

export const metadata = {
  title: 'UBTRIPPIN — Forward your booking emails. Your trip appears.',
  description:
    'Flights, hotels, trains, restaurants — extracted by AI, organized by trip, shared with your family and your agent.',
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
    <div className="min-h-screen bg-white" style={{ scrollBehavior: 'smooth' }}>
      {/* ─── Nav ─── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-white/95 backdrop-blur-sm border-b border-[#cbd5e1]">
        <div className="flex items-center gap-8">
          <Image
            src="/ubtrippin_logo_simple.png"
            alt="UBTRIPPIN"
            width={160}
            height={55}
            className="h-8 w-auto"
            priority
          />
          <div className="hidden md:flex items-center gap-6 text-sm tracking-wide text-[#1e293b]">
            <a href="#features" className="hover:text-[#312e81] transition-colors">Features</a>
            <a href="#pricing" className="hover:text-[#312e81] transition-colors">Pricing</a>
            <a href="#agents" className="hover:text-[#312e81] transition-colors">For Agents</a>
          </div>
        </div>
        <Link
          href="/login"
          className="px-5 py-2 text-sm tracking-widest uppercase bg-[#1e293b] text-white hover:bg-[#312e81] transition-colors font-medium"
        >
          Get Started Free
        </Link>
      </nav>

      <main>
        {/* ─── Hero ─── */}
        <section className="pt-20 pb-16 px-6">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl text-[#1e293b] leading-tight mb-6 font-bold tracking-tight">
                Forward your booking emails. Your trip appears.
              </h1>
              <p className="text-lg text-slate-500 leading-relaxed mb-8 max-w-xl">
                Flights, hotels, trains, restaurants — extracted by AI, organized by trip, shared with your family and your agent.
              </p>
              <div className="flex flex-col sm:flex-row items-start gap-4 mb-8">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-3 px-8 py-4 text-sm tracking-widest uppercase bg-[#1e293b] text-white hover:bg-[#312e81] transition-all font-medium shadow-xl hover:scale-105"
                >
                  <Image src="/airplane_icon.png" alt="" width={24} height={24} className="w-5 h-5 object-contain" />
                  Get started — it&apos;s free
                </Link>
                <a
                  href="#how-it-works"
                  className="text-[#1e293b] font-semibold underline underline-offset-4 hover:text-[#312e81] transition-colors py-4"
                >
                  See how it works ↓
                </a>
              </div>
              <div className="inline-block border-2 border-[#312e81] px-5 py-3 bg-[#f8fafc]">
                <p className="text-sm font-bold text-[#312e81] tracking-wide uppercase mb-0">
                  $10/year for the first 100 subscribers
                </p>
                <p className="text-xs text-slate-500 mt-1">Early bird pricing. Limited spots.</p>
              </div>
            </div>
            <div className="flex justify-center lg:justify-end">
              <Image
                src="/runner_transparent.png"
                alt="UBTRIPPIN strutter"
                width={500}
                height={500}
                className="w-full max-w-md"
                priority
              />
            </div>
          </div>
        </section>

        {/* ─── How It Works ─── */}
        <section id="how-it-works" className="py-24 px-6 bg-[#f8fafc] border-y border-[#cbd5e1]">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-center text-3xl font-bold text-[#1e293b] mb-16 tracking-tight">
              How it works
            </h2>
            <div className="grid md:grid-cols-3 gap-12">
              {[
                {
                  num: '01',
                  title: 'Sign up with Google',
                  desc: 'One click. No passwords to remember.',
                },
                {
                  num: '02',
                  title: 'Forward your booking email',
                  email: 'trips@ubtrippin.xyz',
                  desc: 'Send any confirmation to',
                },
                {
                  num: '03',
                  title: "That's it. Your trip appears.",
                  desc: 'AI extracts everything. Grouped by trip. Automatically.',
                },
              ].map((step) => (
                <div key={step.num} className="relative pt-12">
                  <span className="absolute top-0 left-0 text-4xl font-bold text-[#cbd5e1]">
                    {step.num}
                  </span>
                  <h3 className="text-xl font-bold text-[#1e293b] mb-2">{step.title}</h3>
                  <p className="text-slate-500 leading-relaxed">
                    {step.desc}
                    {step.email && (
                      <>
                        {' '}
                        <code className="font-mono text-sm bg-white px-2 py-0.5 border border-[#cbd5e1] text-[#1e293b]">
                          {step.email}
                        </code>
                      </>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Features ─── */}
        <section id="features" className="py-24 px-6">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-center text-3xl font-bold text-[#1e293b] mb-16 tracking-tight">
              Everything in one place
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: '/airplane_icon.png',
                  title: 'All your bookings',
                  body: 'Forward confirmation emails. AI extracts flights, hotels, trains, cars, restaurants.',
                },
                {
                  icon: '/evelope_icon.png',
                  title: 'Family sharing',
                  body: "Everyone sees everyone's trips. One family, one view.",
                },
                {
                  /* TODO: need hand-drawn lock/vault icon */
                  icon: null,
                  title: 'Loyalty vault',
                  body: 'Store frequent flyer and hotel numbers. Encrypted, always at hand.',
                },
                {
                  icon: '/calendar_icon.png',
                  title: 'Calendar sync',
                  body: 'Subscribe once. Trips in your calendar with real-time status.',
                },
                {
                  /* TODO: need hand-drawn city/map icon */
                  icon: null,
                  title: 'City guides',
                  body: 'Restaurant recs, museum tips, local knowledge by city.',
                },
                {
                  /* TODO: need hand-drawn collaborate/people icon */
                  icon: null,
                  title: 'Collaborate',
                  body: 'Invite co-travelers. Everyone can add and edit.',
                },
              ].map((feat) => (
                <div
                  key={feat.title}
                  className="p-6 border-2 border-[#cbd5e1] hover:border-[#312e81] transition-colors bg-[#f8fafc]"
                >
                  {feat.icon ? (
                    <Image
                      src={feat.icon}
                      alt=""
                      width={40}
                      height={40}
                      className="w-10 h-10 object-contain mb-4"
                    />
                  ) : (
                    /* TODO: replace with hand-drawn icon */
                    <div className="w-10 h-10 mb-4 border-2 border-dashed border-[#cbd5e1] flex items-center justify-center text-xs text-slate-400">
                      ?
                    </div>
                  )}
                  <h3 className="text-sm font-bold text-[#1e293b] mb-2 uppercase tracking-wide">{feat.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{feat.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── For Agents ─── */}
        <section id="agents" className="py-24 px-6 bg-[#f8fafc] border-y border-[#cbd5e1]">
          <div className="max-w-3xl mx-auto">
            <div className="inline-block text-xs font-mono uppercase tracking-widest text-[#312e81] border border-[#312e81] px-3 py-1 mb-6">
              For AI agents
            </div>
            <h2 className="text-3xl font-bold text-[#1e293b] mb-4 tracking-tight">
              Built for the age of agents
            </h2>
            <p className="text-slate-500 leading-relaxed mb-10 max-w-2xl text-lg">
              Give your AI agent an API key. Full access to trips, loyalty vault, and city guides.
            </p>

            <AgentTabs />

            <div className="mt-8">
              <Link
                href="/api/v1/docs"
                className="inline-block px-6 py-3 text-sm tracking-widest uppercase border-2 border-[#1e293b] text-[#1e293b] hover:bg-[#1e293b] hover:text-white transition-colors font-medium"
              >
                Read the API docs
              </Link>
            </div>
          </div>
        </section>

        {/* ─── Pricing ─── */}
        <section id="pricing" className="py-24 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-center text-3xl font-bold text-[#1e293b] mb-4 tracking-tight">
              Simple, transparent pricing
            </h2>
            <p className="text-center text-slate-500 mb-16">Start for free, upgrade when you need more.</p>

            <div className="grid md:grid-cols-2 gap-0 border border-[#cbd5e1]">
              {/* Free */}
              <div className="p-8 md:border-r border-[#cbd5e1]">
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-[#1e293b] mb-2">Free</h3>
                  <p className="text-4xl font-bold text-[#1e293b]">$0</p>
                  <p className="text-sm text-slate-500">Forever</p>
                </div>
                <ul className="space-y-0 mb-8">
                  {[
                    ['Trips', '3'],
                    ['Extractions', '10'],
                    ['Loyalty programs', '3'],
                    ['Family sharing', '—'],
                    ['Calendar feed', '—'],
                    ['Webhooks', '1'],
                    ['Guides', 'Browse'],
                    ['API', 'Read'],
                  ].map(([label, value]) => (
                    <li key={label} className="flex justify-between py-3 border-b border-[#cbd5e1] text-sm">
                      <span className="text-slate-500">{label}</span>
                      <span className="font-semibold text-[#1e293b]">{value}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  className="block text-center py-3 text-sm tracking-widest uppercase border-2 border-[#1e293b] text-[#1e293b] hover:bg-[#1e293b] hover:text-white transition-colors font-medium"
                >
                  Get Started Free
                </Link>
              </div>

              {/* Pro */}
              <div className="p-8 bg-[#f8fafc] relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#312e81] text-white text-xs font-bold tracking-widest uppercase px-3 py-1">
                  Recommended
                </div>
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-[#1e293b] mb-2">Pro</h3>
                  <p className="text-4xl font-bold text-[#312e81]">
                    $10<span className="text-lg text-slate-500">/year</span>
                  </p>
                  <p className="text-sm text-slate-500">First 100 subscribers, then $24.99/year</p>
                  <p className="text-xs text-slate-400">Billed annually</p>
                </div>
                <ul className="space-y-0 mb-8">
                  {[
                    ['Trips', 'Unlimited'],
                    ['Extractions', 'Unlimited'],
                    ['Loyalty programs', 'Unlimited'],
                    ['Family sharing', '✓'],
                    ['Calendar feed', '✓'],
                    ['Webhooks', '10'],
                    ['Guides', 'Create'],
                    ['API', 'Full'],
                  ].map(([label, value]) => (
                    <li key={label} className="flex justify-between py-3 border-b border-[#cbd5e1] text-sm">
                      <span className="text-slate-500">{label}</span>
                      <span className={`font-semibold ${value === '✓' ? 'text-[#312e81]' : 'text-[#1e293b]'}`}>
                        {value}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  className="block text-center py-3 text-sm tracking-widest uppercase bg-[#312e81] text-white hover:bg-[#1e293b] transition-colors font-medium"
                >
                  Claim Your Spot
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ─── FAQ ─── */}
        <section className="py-24 px-6 bg-[#f8fafc] border-y border-[#cbd5e1]">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-center text-3xl font-bold text-[#1e293b] mb-16 tracking-tight">
              Frequently asked questions
            </h2>
            {[
              {
                q: 'Do you read my email?',
                a: 'No. You forward specific emails. We never access your inbox.',
              },
              {
                q: 'What if AI gets it wrong?',
                a: 'You can edit any extraction in two clicks.',
              },
              {
                q: 'Can my AI agent use this?',
                a: 'Yes. Full REST API, OpenClaw skill, MCP server, and CLI.',
              },
              {
                q: 'Is my data safe?',
                a: 'Encrypted at rest, EU-hosted, GDPR compliant.',
              },
              {
                q: 'What emails do you understand?',
                a: 'Airlines, hotels, trains, car rentals, Airbnb, Booking.com, restaurants, and more.',
              },
            ].map((faq) => (
              <details key={faq.q} className="border-b border-[#cbd5e1] group">
                <summary className="flex justify-between items-center py-5 cursor-pointer text-lg font-bold text-[#1e293b] list-none">
                  {faq.q}
                  <span className="text-slate-400 font-mono text-xl group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="pb-5 text-slate-500 leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t border-[#cbd5e1] py-12">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5 text-xs tracking-widest uppercase text-slate-500">
            <Link href="/api/v1/docs" className="hover:text-[#1e293b] transition-colors">Docs</Link>
            <span className="text-[#cbd5e1]">·</span>
            <Link href="/api/v1/docs" className="hover:text-[#1e293b] transition-colors">API Reference</Link>
            <span className="text-[#cbd5e1]">·</span>
            <a href="https://github.com/fistfulayen/ubtrippin" target="_blank" rel="noopener noreferrer" className="hover:text-[#1e293b] transition-colors">GitHub</a>
            <span className="text-[#cbd5e1]">·</span>
            <Link href="/privacy" className="hover:text-[#1e293b] transition-colors">Privacy</Link>
            <span className="text-[#cbd5e1]">·</span>
            <Link href="/terms" className="hover:text-[#1e293b] transition-colors">Terms</Link>
          </div>
          <p className="text-xs text-slate-400 font-mono">Made by humans and agents</p>
        </div>
      </footer>
    </div>
  )
}
