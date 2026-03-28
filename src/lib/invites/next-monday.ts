/** ISO timestamp for next Monday 00:00 UTC. */
export function nextMondayUTC(): string {
  const now = new Date()
  const day = now.getUTCDay() // 0=Sun, 1=Mon …
  const daysUntilMonday = day === 0 ? 1 : 8 - day
  const next = new Date(now)
  next.setUTCDate(now.getUTCDate() + daysUntilMonday)
  next.setUTCHours(0, 0, 0, 0)
  return next.toISOString()
}
