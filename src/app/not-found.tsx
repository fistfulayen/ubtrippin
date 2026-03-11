import Link from 'next/link'
import Image from 'next/image'
import { PublicNav } from '@/components/public-nav'
import { PublicFooter } from '@/components/public-footer'

const popularCities = [
  { name: 'Tokyo', emoji: '🇯🇵', href: '/cities' },
  { name: 'Paris', emoji: '🇫🇷', href: '/cities' },
  { name: 'New York', emoji: '🇺🇸', href: '/cities' },
  { name: 'London', emoji: '🇬🇧', href: '/cities' },
  { name: 'Bangkok', emoji: '🇹🇭', href: '/cities' },
]

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <PublicNav />

      <main className="flex-grow flex items-center px-6">
        <section className="w-full py-16">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
            <div className="flex justify-center lg:order-last">
              <Image
                src="/runner_transparent.png"
                alt="UBTRIPPIN strutter looking lost"
                width={500}
                height={500}
                className="w-full max-w-xs sm:max-w-sm"
              />
            </div>

            <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
              <h1 className="text-4xl sm:text-5xl text-slate-800 leading-tight mb-4 font-bold tracking-tight">
                Took a Wrong Turn?
              </h1>
              <p className="text-lg text-slate-500 leading-relaxed mb-8 max-w-xl">
                The map is not the territory. Looks like you wandered off the trail. The page you&apos;re looking for might have been moved, or maybe it just took a spontaneous trip somewhere else.
              </p>
              <div className="flex flex-col sm:flex-row items-center lg:items-start gap-4 mb-12">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center w-full sm:w-auto px-8 py-4 text-sm tracking-widest uppercase bg-slate-800 text-white hover:bg-indigo-800 transition-colors font-medium shadow-xl hover:scale-105"
                >
                  Get Started Free
                </Link>
                <Link
                  href="/cities"
                  className="text-slate-800 font-semibold underline underline-offset-4 hover:text-indigo-800 transition-colors py-4"
                >
                  Browse Events Instead
                </Link>
              </div>

              <div className="w-full max-w-md">
                <h2 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wide">
                  Maybe you were looking for...
                </h2>
                <div className="flex flex-wrap justify-center lg:justify-start gap-4">
                  {popularCities.map((city) => (
                    <Link
                      key={city.name}
                      href={city.href}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm border-2 border-slate-200 text-slate-800 hover:border-indigo-800 hover:bg-slate-50 transition-colors font-medium rounded-lg"
                    >
                      <span>{city.emoji}</span>
                      {city.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
