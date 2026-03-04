import { createSecretClient } from '@/lib/supabase/service'
import { extractLocalTime } from '@/lib/utils'

type ExtractedEmailItem = {
  kind?: string | null
  provider?: string | null
  confirmation_code?: string | null
  start_date?: string | null
  end_date?: string | null
  start_ts?: string | null
  end_ts?: string | null
}

type TripItemRow = {
  id: string
  kind: string
  provider: string | null
  confirmation_code: string | null
  start_date: string | null
  end_date: string | null
  start_ts: string | null
  end_ts: string | null
  details_json: Record<string, unknown> | null
  source_email_id: string | null
  source_emails: { extracted_json?: { items?: ExtractedEmailItem[] } | null } | null
}

function same(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a || null) === (b || null)
}

function findSourceItem(row: TripItemRow): ExtractedEmailItem | null {
  const items = row.source_emails?.extracted_json?.items
  if (!Array.isArray(items)) return null

  const exact = items.find((item) =>
    same(item.kind, row.kind) &&
    same(item.provider, row.provider) &&
    same(item.confirmation_code, row.confirmation_code) &&
    same(item.start_ts, row.start_ts) &&
    same(item.end_ts, row.end_ts)
  )
  if (exact) return exact

  const byTime = items.find((item) =>
    same(item.kind, row.kind) &&
    same(item.start_ts, row.start_ts) &&
    same(item.end_ts, row.end_ts)
  )
  if (byTime) return byTime

  const byDate = items.find((item) =>
    same(item.kind, row.kind) &&
    same(item.start_date, row.start_date) &&
    same(item.end_date, row.end_date)
  )
  return byDate || null
}

async function main() {
  const supabase = createSecretClient()

  const { data, error } = await supabase
    .from('trip_items')
    .select(`
      id,
      kind,
      provider,
      confirmation_code,
      start_date,
      end_date,
      start_ts,
      end_ts,
      details_json,
      source_email_id,
      source_emails!inner(extracted_json)
    `)
    .in('kind', ['flight', 'train'])
    .not('source_email_id', 'is', null)

  if (error) {
    throw new Error(`Failed to fetch items: ${error.message}`)
  }

  const rows = (data ?? []) as TripItemRow[]
  let scanned = 0
  let updated = 0
  let skipped = 0

  for (const row of rows) {
    scanned++

    const details = { ...(row.details_json || {}) }
    const hasDeparture = typeof details.departure_local_time === 'string' && details.departure_local_time.length > 0
    const hasArrival = typeof details.arrival_local_time === 'string' && details.arrival_local_time.length > 0

    if (hasDeparture && hasArrival) {
      skipped++
      continue
    }

    const sourceItem = findSourceItem(row)
    if (!sourceItem) {
      skipped++
      continue
    }

    let changed = false

    if (!hasDeparture) {
      const departureLocal = extractLocalTime(sourceItem.start_ts ?? row.start_ts)
      if (departureLocal) {
        details.departure_local_time = departureLocal
        changed = true
      }
    }

    if (!hasArrival) {
      const arrivalLocal = extractLocalTime(sourceItem.end_ts ?? row.end_ts)
      if (arrivalLocal) {
        details.arrival_local_time = arrivalLocal
        changed = true
      }
    }

    if (!changed) {
      skipped++
      continue
    }

    const { error: updateError } = await supabase
      .from('trip_items')
      .update({ details_json: details })
      .eq('id', row.id)

    if (updateError) {
      throw new Error(`Failed to update item ${row.id}: ${updateError.message}`)
    }

    updated++
  }

  console.log(JSON.stringify({ scanned, updated, skipped }, null, 2))
}

main().catch((error) => {
  console.error('[backfill-local-times] failed:', error)
  process.exit(1)
})
