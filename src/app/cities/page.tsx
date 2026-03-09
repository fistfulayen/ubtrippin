import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { CityDirectoryCard } from '@/components/events/city-directory-card'
import { PublicNav } from '@/components/public-nav'
import { getItineraryCities, getTrackedCitiesWithEventCounts } from '@/lib/events/queries'

export const metadata: Metadata = {
  title: 'City Events | UBTRIPPIN',
  description: 'Curated city events, exhibitions, performances, and festivals for your next trip.',
}

export default async function CitiesPage() {
  const supabase = await createClient()
  const [
    cities,
    {
      data: { user },
    },
  ] = await Promise.all([
    getTrackedCitiesWithEventCounts(supabase),
    supabase.auth.getUser(),
  ])

  const itineraryCities = user ? await getItineraryCities(supabase, user.id) : []
  const itinerarySlugs = new Set(itineraryCities.map((city) => city.slug))

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white">
      <PublicNav />
      <main className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:px-6 lg:px-8">
        <section className="max-w-3xl space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-indigo-700">City Events</p>
          <h1 className="font-serif text-5xl text-slate-950">Exceptional things worth leaving the hotel for.</h1>
          <p className="text-lg text-slate-600">
            Exhibitions, performances, sacred spaces, and seasonal festivals. Curated city by city.
          </p>
        </section>

        {itineraryCities.length > 0 ? (
          <section className="space-y-5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">On Your Itinerary</p>
              <h2 className="mt-1 font-serif text-3xl text-slate-950">Cities already on your trip map</h2>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {itineraryCities.map((city) => (
                <CityDirectoryCard key={city.id} city={city} isOnTrip />
              ))}
            </div>
          </section>
        ) : null}

        <section className="space-y-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Explore By City</p>
            <h2 className="mt-1 font-serif text-3xl text-slate-950">Where the calendar is strongest right now</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {cities.map((city) => (
              <CityDirectoryCard key={city.id} city={city} isOnTrip={itinerarySlugs.has(city.slug)} />
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
