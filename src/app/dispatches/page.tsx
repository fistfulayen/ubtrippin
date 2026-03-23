import type { Metadata } from 'next'
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

  const htmlEntries = await Promise.all(
    dispatches.map(async (d) => ({
      slug: d.slug,
      html: await markdownToHtml(d.content),
    }))
  )
  const htmlMap = Object.fromEntries(htmlEntries.map((e) => [e.slug, e.html]))

  return (
    <div className="min-h-screen bg-white px-6 py-16 sm:px-8">
      <div className="mx-auto w-full max-w-[65ch]">
        <header className="mb-14 border-b border-slate-200 pb-8">
          <div className="flex items-start justify-between">
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              UBTRIPPIN: THE STORY
            </h1>
            <a
              href="/dispatches/feed.xml"
              title="RSS feed"
              className="mt-2 flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-slate-400 transition-colors hover:text-[#312e81]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M3.75 3a.75.75 0 0 0-.75.75v.5c0 .414.336.75.75.75H4c6.075 0 11 4.925 11 11v.25c0 .414.336.75.75.75h.5a.75.75 0 0 0 .75-.75V16C17 8.82 11.18 3 4 3h-.25Z" />
                <path d="M3 8.75A.75.75 0 0 1 3.75 8H4a8 8 0 0 1 8 8v.25a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1-.75-.75V16a6 6 0 0 0-6-6h-.25A.75.75 0 0 1 3 9.25v-.5ZM7 15a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
              </svg>
              RSS
            </a>
          </div>
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
    </div>
  )
}
