import type { DiaryPlan, PipelineSource } from './types'

export interface DiaryRowLike {
  run_date: string
  diary_text: string
  next_day_plan: unknown
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

export function getPreviousDiary<TDiary extends DiaryRowLike>(diaries: TDiary[], runDate: string): TDiary | null {
  return [...diaries]
    .filter((diary) => diary.run_date < runDate)
    .sort((left, right) => right.run_date.localeCompare(left.run_date))[0] ?? null
}

export function adaptSearchPlan(args: {
  previousDiary: DiaryRowLike | null
  sources: Array<Pick<PipelineSource, 'name' | 'url' | 'status'>>
}): DiaryPlan {
  const base: DiaryPlan = {
    summary: 'No previous diary. Start with balanced RSS, venue, and search coverage.',
    queries: [],
    sourcesToTry: [],
    sourcesToSkip: [],
  }

  if (!args.previousDiary) return base

  const rawPlan =
    args.previousDiary.next_day_plan && typeof args.previousDiary.next_day_plan === 'object'
      ? (args.previousDiary.next_day_plan as Record<string, unknown>)
      : {}

  const queries = toStringArray(rawPlan.queries)
  const sourcesToTry = toStringArray(rawPlan.sourcesToTry)
  const sourcesToSkip = toStringArray(rawPlan.sourcesToSkip)

  const knownDormant = args.sources
    .filter((source) => source.status === 'dormant')
    .map((source) => source.name)

  return {
    summary:
      typeof rawPlan.summary === 'string' && rawPlan.summary.trim()
        ? rawPlan.summary
        : args.previousDiary.diary_text,
    queries,
    sourcesToTry,
    sourcesToSkip: Array.from(new Set([...sourcesToSkip, ...knownDormant])),
  }
}
