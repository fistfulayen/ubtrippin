'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { nanoid } from 'nanoid'
import { getDestinationImageUrl } from '@/lib/images/unsplash'
import { PUBLIC_GUIDE_MIN_ENTRIES, type GuideVisibility } from '@/lib/guides/public'

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

export async function updateGuideMetadata(
  guideId: string,
  city: string,
  country: string | null,
  country_code: string | null
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const nextCity = city.trim()
  const nextCountry = country?.trim() || null
  const nextCountryCode = country_code?.trim().toUpperCase() || null

  if (!nextCity) {
    return { error: 'City is required.' }
  }

  // Validate country_code is exactly 2 ASCII alpha characters if provided
  if (nextCountryCode && !/^[A-Z]{2}$/.test(nextCountryCode)) {
    return { error: 'Invalid country code.' }
  }

  const { error } = await supabase
    .from('city_guides')
    .update({
      city: nextCity,
      country: nextCountry,
      country_code: nextCountryCode,
    })
    .eq('id', guideId)
    .eq('user_id', user.id)

  if (error) {
    // SECURITY (L-005): Never return raw error.message — log server-side, return generic message.
    console.error('[guides/actions] updateGuideLocation failed:', error.message)
    return { error: 'Failed to update guide location. Please try again.' }
  }

  revalidatePath(`/guides/${guideId}`)
  return { ok: true }
}

export type UpdateGuideVisibilityResult =
  | { ok: true }
  | {
      ok: false
      code: 'not_found' | 'missing_public_username' | 'not_enough_entries' | 'update_failed'
      error: string
    }

export async function updateGuideVisibility(
  guideId: string,
  visibility: GuideVisibility
): Promise<UpdateGuideVisibilityResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, code: 'update_failed', error: 'Authentication required.' }
  }

  const { data: guide, error: guideError } = await supabase
    .from('city_guides')
    .select('entry_count, share_token')
    .eq('id', guideId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (guideError || !guide) {
    return { ok: false, code: 'not_found', error: 'Guide not found.' }
  }

  let publicUsername: string | null = null
  let shareToken = guide.share_token

  if (visibility === 'public') {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('public_username')
      .eq('id', user.id)
      .single()

    if (profileError) {
      return { ok: false, code: 'update_failed', error: 'Failed to load your public profile.' }
    }

    publicUsername = (profile as { public_username: string | null }).public_username
    if (!publicUsername) {
      return {
        ok: false,
        code: 'missing_public_username',
        error: 'Set a public username in Settings to share guides publicly.',
      }
    }

    if ((guide.entry_count ?? 0) < PUBLIC_GUIDE_MIN_ENTRIES) {
      return {
        ok: false,
        code: 'not_enough_entries',
        error: `Add at least ${PUBLIC_GUIDE_MIN_ENTRIES} places to publish this guide (currently ${guide.entry_count ?? 0}).`,
      }
    }

    if (!shareToken) {
      shareToken = nanoid(21)
    }
  }

  const { error } = await supabase
    .from('city_guides')
    .update({
      visibility,
      ...(shareToken ? { share_token: shareToken } : {}),
      ...(visibility === 'public' ? { public_username: publicUsername } : {}),
    })
    .eq('id', guideId)
    .eq('user_id', user.id)

  if (error) {
    return { ok: false, code: 'update_failed', error: 'Failed to update guide visibility.' }
  }

  revalidatePath(`/guides/${guideId}`)
  revalidatePath('/guides')
  if (shareToken) {
    revalidatePath(`/guide/${shareToken}`)
  }

  return { ok: true }
}

export async function refreshGuideCoverImage(guideId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: guide } = await supabase
    .from('city_guides')
    .select('id, city')
    .eq('id', guideId)
    .eq('user_id', user.id)
    .single()

  if (!guide?.city) return

  const coverImageUrl = await getDestinationImageUrl(guide.city)
  if (!coverImageUrl) return

  await supabase
    .from('city_guides')
    .update({ cover_image_url: coverImageUrl })
    .eq('id', guideId)
    .eq('user_id', user.id)

  revalidatePath(`/guides/${guideId}`)
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
  const google_place_id = (formData.get('google_place_id') as string)?.trim() || null

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
    google_place_id,
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
  const google_place_id = (formData.get('google_place_id') as string)?.trim() || null

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
      google_place_id,
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
