import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

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

        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">UB Trippin</h1>

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

        {/* Placeholder hero — swap for a real screenshot when ready */}
        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center h-56 text-slate-400 text-sm italic mt-4">
          A beautifully organized trip.
        </div>

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
