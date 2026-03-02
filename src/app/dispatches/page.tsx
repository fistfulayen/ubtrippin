import type { Metadata } from 'next'
import Link from 'next/link'
import { getAllDispatches, markdownToHtml } from '@/lib/dispatches'
import { formatDispatchDate } from '@/lib/format-date'
import { dispatchProseClasses } from '@/lib/dispatch-styles'

export const metadata: Metadata = {
  title: 'UBTRIPPIN: THE STORY',
  description: 'Weekly dispatches from inside the build',
}

const DISPATCHES_PER_PAGE = 5

export default async function DispatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const allDispatches = getAllDispatches()
  const totalPages = Math.max(1, Math.ceil(allDispatches.length / DISPATCHES_PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * DISPATCHES_PER_PAGE
  const dispatches = allDispatches.slice(start, start + DISPATCHES_PER_PAGE)

  // Pre-render all markdown to HTML server-side
  const htmlEntries = await Promise.all(
    dispatches.map(async (d) => ({
      slug: d.slug,
      html: await markdownToHtml(d.content),
    }))
  )
  const htmlMap = Object.fromEntries(htmlEntries.map((e) => [e.slug, e.html]))

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
      <div className="mx-auto w-full max-w-[65ch]">
        <header className="mb-14 border-b border-slate-200 pb-8">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            UBTRIPPIN: THE STORY
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            Weekly dispatches from inside the build
          </p>
        </header>

        <section className="space-y-16">
          {dispatches.map((dispatch) => (
            <article key={dispatch.slug} id={dispatch.slug}>
              <header className="mb-8">
                <p className="text-sm uppercase tracking-[0.16em] text-slate-500">
                  {formatDispatchDate(dispatch.date)}
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                  {dispatch.title}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {dispatch.author} · COO, UBTRIPPIN
                </p>
              </header>

              <div
                className={dispatchProseClasses}
                dangerouslySetInnerHTML={{ __html: htmlMap[dispatch.slug] }}
              />

              <hr className="mt-16 border-slate-200" />
            </article>
          ))}
        </section>

        {totalPages > 1 && (
          <nav className="mt-14 flex items-center justify-between border-t border-slate-200 pt-8">
            {currentPage > 1 ? (
              <a
                href={`/dispatches?page=${currentPage - 1}`}
                className="text-sm uppercase tracking-[0.14em] text-slate-600 transition-colors hover:text-[#312e81]"
              >
                ← Newer
              </a>
            ) : (
              <span />
            )}
            <span className="text-sm text-slate-500">
              {currentPage} / {totalPages}
            </span>
            {currentPage < totalPages ? (
              <a
                href={`/dispatches?page=${currentPage + 1}`}
                className="text-sm uppercase tracking-[0.14em] text-slate-600 transition-colors hover:text-[#312e81]"
              >
                Older →
              </a>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
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
