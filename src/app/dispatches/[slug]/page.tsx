import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { remark } from 'remark'
import remarkHtml from 'remark-html'
import { getAllDispatches, getDispatchBySlug } from '@/lib/dispatches'

interface DispatchPageProps {
  params: Promise<{ slug: string }>
}

function formatDispatchDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
}

async function markdownToHtml(markdown: string): Promise<string> {
  const processedContent = await remark().use(remarkHtml).process(markdown)
  return processedContent.toString()
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
          <p className="mt-4 text-sm text-slate-600">Trip Livingston · COO, UBTRIPPIN</p>
        </header>

        <section
          className="mt-10 text-lg leading-8 text-slate-800 [&_a]:text-[#312e81] [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_h1]:mt-8 [&_h1]:text-3xl [&_h1]:font-semibold [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_li]:my-2 [&_ol]:my-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-5 [&_ul]:my-6 [&_ul]:list-disc [&_ul]:pl-6"
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
      </article>
    </main>
  )
}
