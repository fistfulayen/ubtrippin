import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAllDispatches, getDispatchBySlug, markdownToHtml } from '@/lib/dispatches'
import { formatDispatchDate } from '@/lib/format-date'
import { dispatchProseClasses } from '@/lib/dispatch-styles'

interface DispatchPageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const dispatches = getAllDispatches()
  return dispatches.map((dispatch) => ({ slug: dispatch.slug }))
}

export async function generateMetadata({ params }: DispatchPageProps): Promise<Metadata> {
  const { slug } = await params
  const dispatch = getDispatchBySlug(slug)

  if (!dispatch) {
    return {
      title: 'Dispatch Not Found | UBTRIPPIN: THE STORY',
    }
  }

  return {
    title: `${dispatch.title} | UBTRIPPIN: THE STORY`,
    description: dispatch.summary,
  }
}

export default async function DispatchPage({ params }: DispatchPageProps) {
  const { slug } = await params
  const dispatch = getDispatchBySlug(slug)

  if (!dispatch) {
    notFound()
  }

  const contentHtml = await markdownToHtml(dispatch.content)

  return (
    <>
      <nav className="border-b border-slate-200 bg-white px-6 sm:px-8">
        <div className="mx-auto flex max-w-[65ch] items-center justify-between py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900 hover:text-[#312e81] transition-colors">
            UBTRIPPIN
          </Link>
          <div className="flex items-center gap-6 text-sm text-slate-600">
            <Link href="/" className="hover:text-[#312e81] transition-colors">Home</Link>
            <Link href="/dispatches" className="font-medium text-[#312e81]">Story</Link>
            <Link href="/login" className="hover:text-[#312e81] transition-colors">Log in</Link>
          </div>
        </div>
      </nav>
      <main className="min-h-screen bg-white px-6 py-16 sm:px-8">
        <article className="mx-auto w-full max-w-[65ch]">
          <Link
            href="/dispatches"
            className="text-sm uppercase tracking-[0.14em] text-slate-600 transition-colors hover:text-[#312e81]"
          >
            ← Back to dispatches
          </Link>

          <header className="mt-10 border-b border-slate-200 pb-8">
            <p className="text-sm uppercase tracking-[0.16em] text-slate-500">
              {formatDispatchDate(dispatch.date)}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              {dispatch.title}
            </h1>
            <p className="mt-4 text-sm text-slate-600">{dispatch.author} · COO, UBTRIPPIN</p>
          </header>

          <section
            className={`mt-10 ${dispatchProseClasses}`}
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        </article>
      </main>
      <footer className="border-t border-slate-200 bg-white px-6 sm:px-8">
        <div className="mx-auto flex max-w-[65ch] items-center justify-between py-6 text-sm text-slate-500">
          <span>© {new Date().getFullYear()} UBTRIPPIN</span>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-slate-700 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-700 transition-colors">Terms</Link>
            <Link href="/dispatches/feed.xml" className="hover:text-slate-700 transition-colors">RSS</Link>
          </div>
        </div>
      </footer>
    </>
  )
}
