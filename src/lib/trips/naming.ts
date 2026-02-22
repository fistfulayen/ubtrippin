import { generateText, gateway } from 'ai'
import type { ExtractedItem } from '@/lib/ai/extract-travel-data'

/**
 * Generates a smart, descriptive trip name using AI based on trip items.
 * 
 * Examples:
 * - "Tokyo Spring Break 2026"
 * - "Paris → London Business Trip"
 * - "Tallinn Weekend Getaway"
 * - "Japan Golden Week with Nina"
 * - "Turin & Piedmont Wine Country"
 */
export async function generateTripName(
  items: Array<{
    kind: string
    start_location?: string | null
    end_location?: string | null
    start_date: string
    end_date?: string | null
    provider?: string | null
    summary?: string | null
    traveler_names?: string[]
  }>,
  existingTitle?: string | null
): Promise<string> {
  if (items.length === 0) return existingTitle || 'Untitled Trip'

  // Build context from items
  const itemSummaries = items.map((item) => {
    const parts: string[] = []
    parts.push(`Type: ${item.kind}`)
    if (item.start_location) parts.push(`From: ${item.start_location}`)
    if (item.end_location) parts.push(`To: ${item.end_location}`)
    parts.push(`Date: ${item.start_date}${item.end_date ? ` to ${item.end_date}` : ''}`)
    if (item.provider) parts.push(`Provider: ${item.provider}`)
    if (item.summary) parts.push(`Summary: ${item.summary}`)
    if (item.traveler_names?.length) parts.push(`Travelers: ${item.traveler_names.join(', ')}`)
    return parts.join(', ')
  }).join('\n')

  try {
    const { text } = await generateText({
      model: gateway('anthropic/claude-sonnet-4'),
      prompt: `Generate a short, descriptive trip name (max 6 words) based on these travel items:

${itemSummaries}

Rules:
- Be specific and descriptive (not "Trip - Feb 2026")
- Use destination city/country names
- For multi-city trips, use "→" between cities (max 2-3 cities)
- Include the vibe if clear (business trip, weekend getaway, family vacation, etc.)
- Include month or season only if it adds clarity
- Do NOT include the year
- Do NOT start with "Trip to" — be more creative
- Examples: "Tokyo Spring Break", "Paris → London", "Tallinn Weekend", "Piedmont Wine Country", "Japan Golden Week"

Return ONLY the trip name, nothing else.`,
    })

    const name = text.trim().replace(/^["']|["']$/g, '') // Strip quotes if any
    return name || existingTitle || 'Untitled Trip'
  } catch (error) {
    console.error('Failed to generate trip name:', error)
    // Fall back to simple location-based name
    return fallbackTripName(items) || existingTitle || 'Untitled Trip'
  }
}

/**
 * Check if a trip title is a default/generic one that should be updated.
 */
export function isDefaultTitle(title: string): boolean {
  return /^(Trip\s*-|Trip to|Untitled)/i.test(title)
}

/**
 * Simple fallback name without AI.
 */
function fallbackTripName(items: Array<{ end_location?: string | null; start_location?: string | null; start_date: string }>): string {
  const destinations = new Set<string>()
  for (const item of items) {
    const loc = item.end_location || item.start_location
    if (loc) {
      const clean = loc
        .replace(/\s*\([A-Z]{3}\)\s*/g, '')
        .replace(/^[A-Z]{3}\s*[-–]\s*/, '')
        .trim()
      if (clean) destinations.add(clean)
    }
  }

  if (destinations.size === 0) {
    const date = new Date(items[0].start_date)
    return `Trip - ${date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
  }

  const destArray = Array.from(destinations).slice(0, 3)
  return destArray.join(' → ')
}
