'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { nanoid } from 'nanoid'

// ---------------------------------------------------------------------------
// Guide CRUD
// ---------------------------------------------------------------------------

export async function createGuide(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const city = (formData.get('city') as string)?.trim()
  const country = (formData.get('country') as string)?.trim() || null
  const country_code = (formData.get('country_code') as string)?.trim() || null

  if (!city) return

  const { data: guide, error } = await supabase
    .from('city_guides')
    .insert({ user_id: user.id, city, country, country_code })
    .select('id')
    .single()

  if (error) return

  revalidatePath('/guides')
  redirect(`/guides/${guide.id}`)
}

export async function deleteGuide(guideId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('city_guides')
    .delete()
    .eq('id', guideId)
    .eq('user_id', user.id)

  revalidatePath('/guides')
  redirect('/guides')
}

export async function toggleGuidePublic(guideId: string, isPublic: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Generate share token if making public and none exists
  let share_token: string | undefined
  if (isPublic) {
    const { data: existing } = await supabase
      .from('city_guides')
      .select('share_token')
      .eq('id', guideId)
      .eq('user_id', user.id)
      .single()
    if (!existing?.share_token) {
      share_token = nanoid(21)
    }
  }

  const { error } = await supabase
    .from('city_guides')
    .update({
      is_public: isPublic,
      ...(share_token ? { share_token } : {}),
    })
    .eq('id', guideId)
    .eq('user_id', user.id)

  if (error) return

  revalidatePath(`/guides/${guideId}`)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Entry CRUD
// ---------------------------------------------------------------------------

export async function createEntry(guideId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const name = (formData.get('name') as string)?.trim()
  const category = (formData.get('category') as string)?.trim() || 'Hidden Gems'
  const status = (formData.get('status') as string) === 'to_try' ? 'to_try' : 'visited'
  const description = (formData.get('description') as string)?.trim() || null
  const address = (formData.get('address') as string)?.trim() || null
  const website_url = (formData.get('website_url') as string)?.trim() || null
  const rating_raw = formData.get('rating') as string
  const rating = rating_raw ? parseInt(rating_raw, 10) : null
  const recommended_by = (formData.get('recommended_by') as string)?.trim() || null
  const lat_raw = formData.get('latitude') as string
  const lng_raw = formData.get('longitude') as string
  const latitude = lat_raw ? parseFloat(lat_raw) : null
  const longitude = lng_raw ? parseFloat(lng_raw) : null
  const source_url = (formData.get('source_url') as string)?.trim() || null
  const source = (formData.get('source') as string) || 'manual'

  if (!name) return

  // Verify guide belongs to user
  const { data: guide } = await supabase
    .from('city_guides')
    .select('id')
    .eq('id', guideId)
    .eq('user_id', user.id)
    .single()

  if (!guide) return

  const { data: authorProfile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .maybeSingle()

  const author = authorProfile as { full_name?: string | null; email?: string | null } | null
  const authorName = author?.full_name || author?.email || null

  const { error } = await supabase.from('guide_entries').insert({
    guide_id: guideId,
    user_id: user.id,
    author_id: user.id,
    author_name: authorName,
    name,
    category,
    status,
    description,
    address,
    website_url,
    rating: rating && !isNaN(rating) ? rating : null,
    recommended_by,
    latitude,
    longitude,
    source: source as 'manual' | 'agent' | 'import' | 'share-to',
    source_url,
  })

  if (error) return

  revalidatePath(`/guides/${guideId}`)
  redirect(`/guides/${guideId}`)
}

export async function updateEntry(guideId: string, entryId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const name = (formData.get('name') as string)?.trim()
  const category = (formData.get('category') as string)?.trim() || 'Hidden Gems'
  const status = (formData.get('status') as string) === 'to_try' ? 'to_try' : 'visited'
  const description = (formData.get('description') as string)?.trim() || null
  const address = (formData.get('address') as string)?.trim() || null
  const website_url = (formData.get('website_url') as string)?.trim() || null
  const rating_raw = formData.get('rating') as string
  const rating = rating_raw ? parseInt(rating_raw, 10) : null
  const recommended_by = (formData.get('recommended_by') as string)?.trim() || null
  const lat_raw = formData.get('latitude') as string
  const lng_raw = formData.get('longitude') as string
  const latitude = lat_raw ? parseFloat(lat_raw) : null
  const longitude = lng_raw ? parseFloat(lng_raw) : null

  if (!name) return

  const { error } = await supabase
    .from('guide_entries')
    .update({
      name,
      category,
      status,
      description,
      address,
      website_url,
      rating: rating && !isNaN(rating) ? rating : null,
      recommended_by,
      latitude,
      longitude,
    })
    .eq('id', entryId)
    .eq('user_id', user.id)

  if (error) return

  revalidatePath(`/guides/${guideId}`)
  redirect(`/guides/${guideId}`)
}

export async function deleteEntry(guideId: string, entryId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { error } = await supabase
    .from('guide_entries')
    .delete()
    .eq('id', entryId)
    .eq('user_id', user.id)

  if (error) return

  revalidatePath(`/guides/${guideId}`)
  return { ok: true }
}

export async function markVisited(guideId: string, entryId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { error } = await supabase
    .from('guide_entries')
    .update({ status: 'visited' })
    .eq('id', entryId)
    .eq('user_id', user.id)

  if (error) return

  revalidatePath(`/guides/${guideId}`)
  return { ok: true }
}
