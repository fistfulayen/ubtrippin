/**
 * /add-to-guide — PWA Share Target landing page
 *
 * Receives shared content from the OS Share Sheet (Android PWA Share Target API).
 * Prompts user to pick a guide, then redirects to the add entry form.
 *
 * Share Target params (from manifest.json):
 *   ?name=<page title>
 *   ?text=<selected text>
 *   ?url=<shared URL>
 */

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ShareToGuideForm } from './share-to-guide-form'
import type { CityGuide } from '@/types/database'

interface Props {
  searchParams: Promise<{
    name?: string
    text?: string
    url?: string
  }>
}

export default async function AddToGuidePage({ searchParams }: Props) {
  const { name, text, url } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect(`/login?next=${encodeURIComponent('/add-to-guide')}`)

  const { data: guides } = await supabase
    .from('city_guides')
    .select('id, city, country_code')
    .order('updated_at', { ascending: false })

  const allGuides = (guides ?? []) as Pick<CityGuide, 'id' | 'city' | 'country_code'>[]

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 flex items-start justify-center px-4 py-16">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add to a guide</h1>
          {(name || url) && (
            <p className="text-gray-600 mt-1 text-sm">
              {name || url}
            </p>
          )}
        </div>

        <ShareToGuideForm
          guides={allGuides}
          sharedName={name ?? ''}
          sharedUrl={url ?? ''}
          sharedText={text ?? ''}
        />
      </div>
    </div>
  )
}
