import Link from 'next/link'
import type { Metadata } from 'next'
import { getAllDispatches } from '@/lib/dispatches'

export const metadata: Metadata = {
  title: 'UBTRIPPIN: THE STORY',
  description: 'Weekly dispatches from inside the build',
}

function formatDispatchDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
}

export default function DispatchesPage() {
  const dispatches = getAllDispatches()

  return (
    <main className="min-h-screen bg-white px-6 py-16 sm:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-14 border-b border-slate-200 pb-8">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            UBTRIPPIN: THE STORY
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            Weekly dispatches from inside the build
          </p>
        </header>

        <section className="space-y-10">
          {dispatches.map((dispatch) => (
            <article key={dispatch.slug} className="border-b border-slate-200 pb-8 last:border-none">
              <p className="text-sm uppercase tracking-[0.16em] text-slate-500">
                {formatDispatchDate(dispatch.date)}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                <Link href={`/dispatches/${dispatch.slug}`} className="hover:text-[#312e81] transition-colors">
                  {dispatch.title}
                </Link>
              </h2>
              <p className="mt-4 max-w-[65ch] text-lg leading-8 text-slate-700">{dispatch.summary}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  )
}
