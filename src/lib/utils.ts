import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatTime(date: string | Date | null | undefined): string {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return ''
  return `${formatDate(date)} at ${formatTime(date)}`
}

export function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return ''
  if (!end || start === end) return formatDate(start)

  const startDate = new Date(start!)
  const endDate = new Date(end)

  // Same month and year
  if (startDate.getMonth() === endDate.getMonth() &&
      startDate.getFullYear() === endDate.getFullYear()) {
    return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.getDate()}, ${endDate.getFullYear()}`
  }

  // Different months or years
  return `${formatDate(start)} - ${formatDate(end)}`
}

export function getDaysBetween(start: string | Date, end: string | Date): number {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const diffTime = endDate.getTime() - startDate.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

export function groupByDate<T extends { start_date: string }>(items: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>()

  for (const item of items) {
    const date = item.start_date
    if (!grouped.has(date)) {
      grouped.set(date, [])
    }
    grouped.get(date)!.push(item)
  }

  return grouped
}

export function getKindIcon(kind: string): string {
  switch (kind) {
    case 'flight':
      return 'plane'
    case 'hotel':
      return 'building'
    case 'train':
      return 'train-front'
    case 'car':
      return 'car'
    case 'restaurant':
      return 'utensils'
    case 'activity':
      return 'ticket'
    default:
      return 'calendar'
  }
}

export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return ''
  // Basic HTML sanitization - remove script tags and event handlers
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
}
