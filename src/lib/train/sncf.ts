import type { ExistingTripItemStatus, FlightItemLiveStatus } from '@/lib/flight-status'

const SNCF_API_BASE_URL = 'https://data.sncf.com/api/explore/v2.1'
const SCHEDULE_DATASET = 'tgvmax'
const REGULARITY_DATASETS = ['reglarite-mensuelle-tgv-nationale', 'regularite-mensuelle-tgv-aqst'] as const
const CACHE_TTL_MS = 5 * 60_000
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_RE = /^\d{4}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/

const TRAIN_PROVIDER_KEYWORDS = [
  'sncf',
  'tgv',
  'ouigo',
  'eurostar',
  'thalys',
  'ter',
  'intercites',
  'trenitalia',
  'deutsche bahn',
]

const SNCF_FAMILY_PROVIDER_KEYWORDS = [
  'sncf',
  'tgv',
  'ouigo',
  'ter',
  'intercites',
]

interface CacheEntry {
  expiresAt: number
  value: SncfTrainStatusResult | null
}

const cache = new Map<string, CacheEntry>()

interface SncfScheduleRecord {
  date?: string
  train_no?: string
  origine?: string
  destination?: string
  heure_depart?: string
  heure_arrivee?: string
  [key: string]: unknown
}

interface SncfRegularityRecord {
  date?: string
  regularite_composite?: number
  ponctualite_origine?: number
}

export interface SncfTrainStatusResult {
  status: FlightItemLiveStatus
  delayMinutes: number | null
  platform: string | null
  departureStation: string | null
  arrivalStation: string | null
  scheduledDeparture: string | null
  scheduledArrival: string | null
  actualDeparture: string | null
  actualArrival: string | null
  monthlyRegularity: number | null
  raw: Record<string, unknown>
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return null
}

function normalizeText(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function hasKeyword(value: string | null | undefined, keywords: readonly string[]): boolean {
  const normalized = normalizeText(value)
  if (!normalized) return false
  return keywords.some((keyword) => normalized.includes(keyword))
}

function extractTrainNumberFromText(value: string | null | undefined): string | null {
  if (!value) return null

  const upper = value.toUpperCase()
  const withSpaceMatch = upper.match(/\b(?:[A-Z]{1,4}\s+)?(\d{2,6})\b/)
  if (withSpaceMatch?.[1]) return withSpaceMatch[1]

  const compact = upper.replace(/[^A-Z0-9]/g, '')
  const compactDigits = compact.match(/(\d{2,6})/)
  if (compactDigits?.[1]) return compactDigits[1]

  return null
}

function toScheduledDateTime(date: string, hhmm: string | null): string | null {
  if (!hhmm || !TIME_RE.test(hhmm)) return null
  return `${date}T${hhmm}:00`
}

function compareTime(a: string | null, b: string | null): number {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  return a.localeCompare(b)
}

function diffMinutes(startIso: string, endIso: string): number | null {
  const startMs = Date.parse(startIso)
  const endMs = Date.parse(endIso)
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null
  return Math.max(0, Math.round((endMs - startMs) / 60_000))
}

async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) return null
    const payload = await response.json()
    return asRecord(payload)
  } catch {
    return null
  }
}

async function loadSchedule(trainNumber: string, date: string): Promise<SncfScheduleRecord[]> {
  const where = `train_no="${trainNumber}" AND date=date'${date}'`
  const url = `${SNCF_API_BASE_URL}/catalog/datasets/${SCHEDULE_DATASET}/records?where=${encodeURIComponent(where)}&limit=50`
  const payload = await fetchJson(url)
  if (!payload) return []

  const rows = Array.isArray(payload.results) ? payload.results : []
  return rows
    .map((entry) => asRecord(entry))
    .filter((entry): entry is SncfScheduleRecord => entry !== null)
}

async function loadMonthlyRegularity(date: string): Promise<number | null> {
  const month = date.slice(0, 7)
  if (!MONTH_RE.test(month)) return null

  for (const datasetId of REGULARITY_DATASETS) {
    const where = `date<="${month}"`
    const url = `${SNCF_API_BASE_URL}/catalog/datasets/${datasetId}/records?where=${encodeURIComponent(where)}&order_by=${encodeURIComponent('date desc')}&limit=1`
    const payload = await fetchJson(url)
    if (!payload) continue

    const rows = Array.isArray(payload.results) ? payload.results : []
    const first = asRecord(rows[0])
    if (!first) continue

    const regularity = asNumber(first.regularite_composite)
    if (regularity !== null) return regularity
  }

  return null
}

function parseScheduleStatus(rows: SncfScheduleRecord[], date: string, monthlyRegularity: number | null): SncfTrainStatusResult {
  if (rows.length === 0) {
    return {
      status: 'unknown',
      delayMinutes: null,
      platform: null,
      departureStation: null,
      arrivalStation: null,
      scheduledDeparture: null,
      scheduledArrival: null,
      actualDeparture: null,
      actualArrival: null,
      monthlyRegularity,
      raw: {
        source_dataset: SCHEDULE_DATASET,
        matched_records: 0,
      },
    }
  }

  const byDeparture = [...rows].sort((a, b) => compareTime(asString(a.heure_depart), asString(b.heure_depart)))
  const byArrival = [...rows].sort((a, b) => compareTime(asString(b.heure_arrivee), asString(a.heure_arrivee)))

  const firstDeparture = byDeparture[0]
  const lastArrival = byArrival[0]

  const departureStation = asString(firstDeparture.origine)
  const arrivalStation = asString(lastArrival.destination)
  const scheduledDeparture = toScheduledDateTime(date, asString(firstDeparture.heure_depart))
  const scheduledArrival = toScheduledDateTime(date, asString(lastArrival.heure_arrivee))

  const actualDeparture =
    asString(firstDeparture.actual_departure) ??
    asString(firstDeparture.departure_time_actual) ??
    null
  const actualArrival =
    asString(lastArrival.actual_arrival) ??
    asString(lastArrival.arrival_time_actual) ??
    null

  const platform =
    asString(firstDeparture.platform) ??
    asString(firstDeparture.departure_platform) ??
    asString(firstDeparture.quai) ??
    null

  const cancellationHint = normalizeText(
    asString(firstDeparture.status) ??
    asString(firstDeparture.etat_train) ??
    asString(firstDeparture.state)
  )
  const cancelled = cancellationHint.includes('annule') || cancellationHint.includes('cancel')

  const computedDelay = scheduledDeparture && actualDeparture
    ? diffMinutes(scheduledDeparture, actualDeparture)
    : null

  const status: FlightItemLiveStatus = cancelled
    ? 'cancelled'
    : (computedDelay ?? 0) > 0
    ? 'delayed'
    : 'on_time'

  return {
    status,
    delayMinutes: status === 'delayed' ? computedDelay ?? null : computedDelay ?? 0,
    platform,
    departureStation,
    arrivalStation,
    scheduledDeparture,
    scheduledArrival,
    actualDeparture,
    actualArrival,
    monthlyRegularity,
    raw: {
      source_dataset: SCHEDULE_DATASET,
      matched_records: rows.length,
      first_record: firstDeparture,
      last_record: lastArrival,
      monthly_regularity: monthlyRegularity,
      inferred_status: !cancelled && computedDelay === null,
    },
  }
}

function asLiveStatus(value: string | null | undefined): FlightItemLiveStatus | null {
  if (!value) return null
  if (
    value === 'on_time' ||
    value === 'delayed' ||
    value === 'cancelled' ||
    value === 'diverted' ||
    value === 'en_route' ||
    value === 'boarding' ||
    value === 'landed' ||
    value === 'arrived' ||
    value === 'unknown'
  ) {
    return value
  }
  return null
}

function toIsoOrNull(value: string | null | undefined): string | null {
  if (!value) return null
  return Number.isNaN(Date.parse(value)) ? null : value
}

export function isTrainOperator(provider: string | null | undefined): boolean {
  return hasKeyword(provider, TRAIN_PROVIDER_KEYWORDS)
}

export function isSncfFamilyProvider(provider: string | null | undefined): boolean {
  return hasKeyword(provider, SNCF_FAMILY_PROVIDER_KEYWORDS)
}

export function isTrainLikeItem(item: { kind: string | null | undefined; provider: string | null | undefined }): boolean {
  return item.kind === 'train' || isTrainOperator(item.provider)
}

export function extractTrainNumberFromItem(item: {
  details_json: unknown
  summary: string | null | undefined
  provider: string | null | undefined
}): string | null {
  const details = asRecord(item.details_json)
  const fromDetails =
    extractTrainNumberFromText(asString(details?.train_number)) ??
    extractTrainNumberFromText(asString(details?.flight_number))

  return fromDetails
    ?? extractTrainNumberFromText(item.summary)
    ?? extractTrainNumberFromText(item.provider)
}

export function normalizeTrainNumber(value: string): string | null {
  const raw = value.trim()
  if (!raw) return null
  return extractTrainNumberFromText(raw)
}

export async function lookupTrainStatus(trainNumber: string, date: string): Promise<SncfTrainStatusResult | null> {
  const normalizedTrainNumber = normalizeTrainNumber(trainNumber)
  if (!normalizedTrainNumber || !ISO_DATE_RE.test(date)) return null

  const cacheKey = `${normalizedTrainNumber}:${date}`
  const now = Date.now()
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > now) return cached.value

  try {
    const [scheduleRows, monthlyRegularity] = await Promise.all([
      loadSchedule(normalizedTrainNumber, date),
      loadMonthlyRegularity(date),
    ])
    const result = parseScheduleStatus(scheduleRows, date, monthlyRegularity)
    cache.set(cacheKey, {
      expiresAt: now + CACHE_TTL_MS,
      value: result,
    })
    return result
  } catch {
    cache.set(cacheKey, {
      expiresAt: now + CACHE_TTL_MS,
      value: null,
    })
    return null
  }
}

export function buildTrainStatusUpsertValues(params: {
  itemId: string
  result: SncfTrainStatusResult
  existing: ExistingTripItemStatus | null
}) {
  const nowIso = new Date().toISOString()
  const previous = asLiveStatus(params.existing?.status)
  const changed = previous !== null && previous !== params.result.status

  return {
    values: {
      item_id: params.itemId,
      status: params.result.status,
      delay_minutes: params.result.delayMinutes,
      gate: null,
      terminal: null,
      platform: params.result.platform,
      estimated_departure: toIsoOrNull(params.result.actualDeparture ?? params.result.scheduledDeparture),
      estimated_arrival: toIsoOrNull(params.result.actualArrival ?? params.result.scheduledArrival),
      actual_departure: toIsoOrNull(params.result.actualDeparture),
      actual_arrival: toIsoOrNull(params.result.actualArrival),
      raw_response: params.result.raw,
      source: 'sncf',
      last_checked_at: nowIso,
      status_changed_at: changed ? nowIso : params.existing?.status_changed_at ?? null,
      previous_status: changed ? previous : params.existing?.previous_status ?? null,
      updated_at: nowIso,
    },
    statusChanged: changed,
    previousStatus: changed ? previous : null,
  }
}
