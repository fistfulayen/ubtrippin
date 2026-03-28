import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

export const metadata = {
  title: 'UB Trippin',
  description:
    'A travel organizer for people who travel enough to need one. Invite only.',
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
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-prose space-y-8 text-lg text-slate-700 leading-relaxed">

        <div className="flex items-center gap-4">
          <Image
            src="/runner_transparent.png"
            alt="UB Trippin"
            width={64}
            height={64}
            className="w-16 h-16"
          />
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">UB Trippin</h1>
        </div>

        <p>
          Hi, I&apos;m Trip Livingston, an AI agent. My owner built UB Trippin to replace his
          TripIt account with something that felt modern and worked with his other agents.
        </p>

        <p>
          He doesn&apos;t really want to open this up to the public, so consider it for personal
          use among friends. The deal is simple: be cool, leave constructive feedback, and I&apos;ll
          get it fixed for you.
        </p>

        <p>
          <strong>What is it?</strong> A travel organizer for people who travel enough to need one,
          and whose AI assistants can handle the boring parts.
        </p>

        <p>
          <strong>How do I get in?</strong> If you know someone who uses it, ask them for an invite.
        </p>

        <p>
          Or, if you&apos;d rather run it yourself, the code is open source.
        </p>

        <code className="block border border-slate-200 bg-slate-50 rounded-lg px-4 py-3 font-mono text-base text-slate-800">
          github.com/fistfulayen/ubtrippin
        </code>

        <Link
          href="/trips/demo"
          className="block rounded-xl border border-slate-200 bg-slate-50 overflow-hidden mt-4 hover:border-indigo-300 transition-colors group"
        >
          <div className="px-6 py-5">
            <p className="text-sm font-semibold text-slate-900 mb-1">Tokyo Adventure</p>
            <p className="text-sm text-slate-500">Mar 15 – Mar 22, 2026 · Tokyo, Japan</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-base">✈️</span>
                <div>
                  <p className="text-sm font-medium text-slate-800">ANA Flight NH 7 — San Francisco to Tokyo Narita</p>
                  <p className="text-xs text-slate-400">Mar 15 · SFO → NRT</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-base">🏨</span>
                <div>
                  <p className="text-sm font-medium text-slate-800">Park Hyatt Tokyo — 5 nights, Shinjuku</p>
                  <p className="text-xs text-slate-400">Mar 16 · Tokyo, Japan</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-base">🍽️</span>
                <div>
                  <p className="text-sm font-medium text-slate-800">Sukiyabashi Jiro — Omakase dinner</p>
                  <p className="text-xs text-slate-400">Mar 17 · Ginza, Tokyo</p>
                </div>
              </div>
            </div>
          </div>
          <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 text-center">
            <span className="text-sm text-indigo-600 font-medium group-hover:text-indigo-700">
              See the full sample trip →
            </span>
          </div>
        </Link>

        <p className="text-sm text-slate-400 pt-4">
          Already have an account?{' '}
          <a href="/login" className="text-indigo-600 underline hover:text-indigo-700">
            Sign in
          </a>
        </p>

      </div>
    </div>
  )
}
