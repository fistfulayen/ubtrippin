import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, BookOpen, Globe, Lock, MapPin } from 'lucide-react'
import type { CityGuide } from '@/types/database'

export default async function GuidesPage() {
  const supabase = await createClient()

  const { data: guides } = await supabase
    .from('city_guides')
    .select('*')
    .order('updated_at', { ascending: false })

  const allGuides = (guides ?? []) as CityGuide[]
  const hasGuides = allGuides.length > 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">City Guides</h1>
          <p className="text-gray-600">
            Your personal collection of places, recommendations, and hidden gems
          </p>
        </div>
        <Link href="/guides/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Guide
          </Button>
        </Link>
      </div>

      {!hasGuides ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No guides yet</h2>
          <p className="text-gray-500 mb-6 max-w-sm mx-auto">
            Start building your personal city guide. Add the coffee shop that&apos;s actually good,
            the restaurant not in any guide, the park where locals go.
          </p>
          <Link href="/guides/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create your first guide
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allGuides.map((guide) => (
            <GuideCard key={guide.id} guide={guide} />
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="rounded-xl bg-white border border-[#cbd5e1] p-4">
        <h3 className="font-medium text-[#1e293b]">Quick tip</h3>
        <p className="mt-1 text-sm text-[#1e293b]">
          Ask your agent to add places: &ldquo;Add Télescope to my Paris guide under Coffee —
          great espresso, tiny space on rue Villedo.&rdquo;
        </p>
      </div>
    </div>
  )
}

function GuideCard({ guide }: { guide: CityGuide }) {
  const flag = guide.country_code
    ? String.fromCodePoint(
        ...guide.country_code
          .toUpperCase()
          .split('')
          .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
      )
    : null

  return (
    <Link href={`/guides/${guide.id}`}>
      <div className="group rounded-xl border border-gray-200 bg-white p-5 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer">
        {/* Cover image or placeholder */}
        {guide.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={guide.cover_image_url}
            alt={guide.city}
            className="w-full h-32 object-cover rounded-lg mb-4"
          />
        ) : (
          <div className="w-full h-32 rounded-lg mb-4 bg-gradient-to-br from-indigo-50 to-slate-100 flex items-center justify-center">
            <MapPin className="h-8 w-8 text-indigo-300" />
          </div>
        )}

        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors flex items-center gap-2">
              {flag && <span>{flag}</span>}
              {guide.city}
            </h2>
            {guide.country && (
              <p className="text-sm text-gray-500">{guide.country}</p>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
            {guide.is_public ? (
              <Globe className="h-3.5 w-3.5" />
            ) : (
              <Lock className="h-3.5 w-3.5" />
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            {guide.entry_count} {guide.entry_count === 1 ? 'place' : 'places'}
          </span>
        </div>
      </div>
    </Link>
  )
}
