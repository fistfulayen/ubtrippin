/**
 * PRD-044: Feedback Image Lifecycle Cleanup
 *
 * Images attached to feedback should be deleted from Supabase Storage
 * after the feedback is shipped/resolved. This prevents storage from
 * ballooning over time.
 *
 * Intended to be called from a daily cron job.
 */

import { createSecretClient } from '@/lib/supabase/service'

const CLEANUP_DELAY_HOURS = 24
const FEEDBACK_IMAGES_BUCKET = 'feedback-images'

interface CleanupResult {
  checked: number
  cleaned: number
  errors: string[]
}

/**
 * Delete images from shipped/declined feedback older than CLEANUP_DELAY_HOURS.
 * Updates the feedback row to null out image_url after deletion.
 *
 * Uses service client because this runs as an admin cron job, not a user request.
 */
export async function cleanupResolvedFeedbackImages(): Promise<CleanupResult> {
  const supabase = createSecretClient()
  const result: CleanupResult = { checked: 0, cleaned: 0, errors: [] }

  const cutoff = new Date(Date.now() - CLEANUP_DELAY_HOURS * 60 * 60 * 1000).toISOString()

  // Find feedback with images that was resolved before the cutoff
  const { data: items, error } = await supabase
    .from('feedback')
    .select('id, image_url, resolved_at')
    .in('status', ['shipped', 'declined'])
    .not('image_url', 'is', null)
    .lt('resolved_at', cutoff)
    .limit(50) // batch size

  if (error) {
    result.errors.push(`Query failed: ${error.message}`)
    return result
  }

  if (!items) return result

  result.checked = items.length

  for (const item of items) {
    try {
      // Extract storage path from full URL
      const url = item.image_url as string
      const pathMatch = url.match(/feedback-images\/(.+)$/)
      if (!pathMatch) {
        result.errors.push(`Cannot parse storage path from ${url}`)
        continue
      }

      const storagePath = decodeURIComponent(pathMatch[1])

      // Delete from storage
      const { error: deleteError } = await supabase.storage
        .from(FEEDBACK_IMAGES_BUCKET)
        .remove([storagePath])

      if (deleteError) {
        result.errors.push(`Delete failed for ${item.id}: ${deleteError.message}`)
        continue
      }

      // Null out image_url
      const { error: updateError } = await supabase
        .from('feedback')
        .update({ image_url: null })
        .eq('id', item.id)

      if (updateError) {
        result.errors.push(`Update failed for ${item.id}: ${updateError.message}`)
        continue
      }

      result.cleaned++
    } catch (err) {
      result.errors.push(`Unexpected error for ${item.id}: ${err}`)
    }
  }

  return result
}
