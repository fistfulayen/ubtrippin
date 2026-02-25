import { createSecretClient } from '@/lib/supabase/service'

export interface ExtractionExample {
  id: string
  email_subject: string | null
  email_body_snippet: string
  attachment_text_snippet: string | null
  corrected_extraction: Record<string, unknown>
  provider_pattern: string | null
  item_kind: string | null
  usage_count: number
}

/**
 * Select relevant few-shot examples for extraction based on sender domain.
 * Prioritizes provider-specific examples, falls back to global high-quality ones.
 */
export async function selectExamples(
  senderDomain?: string
): Promise<ExtractionExample[]> {
  const supabase = createSecretClient()

  // Build query - prioritize provider-specific matches, then global examples
  let query = supabase
    .from('extraction_examples')
    .select('id, email_subject, email_body_snippet, attachment_text_snippet, corrected_extraction, provider_pattern, item_kind, usage_count')

  if (senderDomain) {
    // Get examples matching this provider or global examples
    query = query.or(`provider_pattern.ilike.%${senderDomain}%,is_global.eq.true`)
  } else {
    // Only get global examples if no sender domain provided
    query = query.eq('is_global', true)
  }

  const { data, error } = await query
    .order('usage_count', { ascending: false })
    .limit(3)

  if (error) {
    console.error('Failed to fetch extraction examples:', error)
    return []
  }

  // Increment usage count for selected examples
  if (data && data.length > 0) {
    const exampleIds = data.map(e => e.id)
    await supabase.rpc('increment_example_usage', { example_ids: exampleIds })
  }

  return data || []
}

/**
 * Create a truncated, anonymized snippet of email content for storage.
 * Preserves structure while limiting size.
 */
export function createEmailSnippet(
  body: string,
  maxLength: number = 500
): string {
  if (!body) return ''

  // Remove excessive whitespace
  let snippet = body.replace(/\s+/g, ' ').trim()

  // Truncate if too long
  if (snippet.length > maxLength) {
    snippet = snippet.substring(0, maxLength) + '...'
  }

  return snippet
}
