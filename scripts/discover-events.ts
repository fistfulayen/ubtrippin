/**
 * Example daily cron:
 * 15 5 * * * cd /home/iancr/ubtrippin && npx tsx scripts/discover-events.ts --all >> /tmp/ubtrippin-event-pipeline.log 2>&1
 */

import { createSecretClient } from '@/lib/supabase/service'
import { runCityDiscovery } from './lib/discover-events-core'
import type { PipelineCity } from './lib/types'

interface CliOptions {
  citySlug: string | null
  all: boolean
  dryRun: boolean
}

function parseArgs(argv: string[]): CliOptions {
  let citySlug: string | null = null
  let all = false
  let dryRun = false

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--city') {
      citySlug = argv[index + 1] ?? null
      index += 1
      continue
    }
    if (token === '--all') {
      all = true
      continue
    }
    if (token === '--dry-run') {
      dryRun = true
    }
  }

  if ((!citySlug && !all) || (citySlug && all)) {
    throw new Error('Usage: npx tsx scripts/discover-events.ts --city <slug> [--dry-run] | --all [--dry-run]')
  }

  return { citySlug, all, dryRun }
}

async function loadCities(citySlug: string | null): Promise<PipelineCity[]> {
  const supabase = createSecretClient()
  let query = supabase
    .from('tracked_cities')
    .select('id, city, country, country_code, slug, timezone, last_refreshed_at')
    .order('city', { ascending: true })

  if (citySlug) {
    query = query.eq('slug', citySlug)
  }

  const { data, error } = await query
  if (error) throw new Error(`Failed to load tracked cities: ${error.message}`)
  const cities = (data ?? []) as PipelineCity[]
  if (cities.length === 0) throw new Error(citySlug ? `No tracked city found for slug "${citySlug}".` : 'No tracked cities found.')
  return cities
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const supabase = createSecretClient()
  const cities = await loadCities(options.citySlug)

  for (const city of cities) {
    console.log(`[${city.city}] Reading yesterday's diary...`)
    const summary = await runCityDiscovery({
      supabase,
      city,
      dryRun: options.dryRun,
    })

    console.log(`[${city.city}] Sources checked: ${summary.sourcesChecked}`)
    for (const report of summary.reports) {
      const marker = report.status === 'success' ? '✓' : report.status === 'skipped' ? '→' : '✗'
      const detail = report.status === 'error' ? ` (${report.errorMessage})` : ''
      console.log(`  ${marker} ${report.sourceName}: ${report.eventsFound} events${detail}`)
    }

    if (options.dryRun) {
      console.log(
        `[${city.city}] DRY RUN — would insert ${summary.inserted} events, update ${summary.updated}, skip ${summary.duplicates} duplicates, filter ${summary.belowThreshold}`
      )
    } else {
      console.log(
        `[${city.city}] Inserted ${summary.inserted} events, updated ${summary.updated}, skipped ${summary.duplicates} duplicates, filtered ${summary.belowThreshold}`
      )
    }

    console.log(`[${city.city}] Diary:`)
    console.log(`  ${summary.diaryText}`)
    console.log(`[${city.city}] Next-day plan: ${summary.nextDayPlan.summary}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
