import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicNav } from '@/components/public-nav'
import { PublicFooter } from '@/components/public-footer'

export const metadata: Metadata = {
  title: 'Demo — See UB Trippin in Action',
  description:
    'Watch how UB Trippin turns your booking emails into organized trips in seconds.',
  openGraph: {
    title: 'Demo — See UB Trippin in Action',
    description:
      'Watch how UB Trippin turns your booking emails into organized trips in seconds.',
    url: 'https://www.ubtrippin.xyz/demo',
    type: 'website',
  },
}

// Replace with actual YouTube video ID once recorded
const YOUTUBE_VIDEO_ID = null as string | null

export default function DemoPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PublicNav />

      <main className="flex-1">
        <section className="py-24 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl font-bold text-[#1e293b] mb-4 tracking-tight">
              See it in action
            </h1>
            <p className="text-lg text-slate-500 mb-12 max-w-xl mx-auto">
              Forward a booking email. Get an organized trip. Share it with
              anyone. That&apos;s it.
            </p>

            {/* Video embed */}
            <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-[#cbd5e1] bg-[#f1f5f9] mb-12">
              {YOUTUBE_VIDEO_ID ? (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${YOUTUBE_VIDEO_ID}?rel=0`}
                  title="UB Trippin Demo"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                  loading="lazy"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-6xl mb-4">🎬</div>
                    <p className="text-slate-500 text-sm tracking-wide uppercase">
                      Demo video coming soon
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/login"
                className="px-8 py-3 bg-[#1e293b] text-white text-sm tracking-widest uppercase font-medium hover:bg-[#334155] transition-colors"
              >
                Try it free
              </Link>
              <Link
                href="/#features"
                className="px-8 py-3 text-sm tracking-widest uppercase border-2 border-[#1e293b] text-[#1e293b] hover:bg-[#1e293b] hover:text-white transition-colors font-medium"
              >
                See features
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
