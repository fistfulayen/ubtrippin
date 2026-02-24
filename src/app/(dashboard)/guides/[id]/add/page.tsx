import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createEntry } from '../../actions'
import { EntryForm } from '../../entry-form'
import type { CityGuide } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    name?: string
    url?: string
    text?: string
  }>
}

export default async function AddEntryPage({ params, searchParams }: Props) {
  const { id } = await params
  const { name, url, text } = await searchParams

  const supabase = await createClient()
  const { data: guide } = await supabase
    .from('city_guides')
    .select('id, city')
    .eq('id', id)
    .single()

  if (!guide) notFound()

  const g = guide as Pick<CityGuide, 'id' | 'city'>

  // Bind the action to this guide
  const action = createEntry.bind(null, id)

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
        <h1 className="text-2xl font-bold text-gray-900">Add a place</h1>
        <p className="text-gray-600 mt-1">
          Add to your {g.city} guide
        </p>
      </div>

      <EntryForm
        action={action}
        cancelHref={`/guides/${id}`}
        defaultValues={{
          name: name ?? '',
          source_url: url ?? '',
          description: text ?? '',
          source: url ? 'share-to' : 'manual',
        }}
      />
    </div>
  )
}
