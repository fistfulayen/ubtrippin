import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { updateEntry } from '../../../../actions'
import { EntryForm } from '../../../../entry-form'
import type { CityGuide, GuideEntry } from '@/types/database'

interface Props {
  params: Promise<{ id: string; eid: string }>
}

export default async function EditEntryPage({ params }: Props) {
  const { id, eid } = await params

  const supabase = await createClient()

  const [{ data: guide }, { data: entry }] = await Promise.all([
    supabase.from('city_guides').select('id, city').eq('id', id).single(),
    supabase.from('guide_entries').select('*').eq('id', eid).eq('guide_id', id).single(),
  ])

  if (!guide || !entry) notFound()

  const g = guide as Pick<CityGuide, 'id' | 'city'>
  const e = entry as GuideEntry

  const action = updateEntry.bind(null, id, eid)

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <Link
        href={`/guides/${id}`}
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to {g.city}
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Edit place</h1>
        <p className="text-gray-600 mt-1">{e.name}</p>
      </div>

      <EntryForm
        action={action}
        cancelHref={`/guides/${id}`}
        defaultValues={{
          name: e.name,
          category: e.category,
          status: e.status,
          description: e.description ?? '',
          address: e.address ?? '',
          website_url: e.website_url ?? '',
          rating: e.rating ? String(e.rating) : '',
          recommended_by: e.recommended_by ?? '',
          latitude: e.latitude ? String(e.latitude) : '',
          longitude: e.longitude ? String(e.longitude) : '',
          source_url: e.source_url ?? '',
          source: e.source,
        }}
      />
    </div>
  )
}
