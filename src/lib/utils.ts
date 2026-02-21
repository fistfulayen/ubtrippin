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

/**
 * Format a timestamp for display, preserving the LOCAL time from the original ISO string.
 * 
 * Travel times should always display in local time (departure in departure city's time,
 * arrival in arrival city's time). ISO 8601 strings with timezone offsets like
 * "2026-03-15T22:30:00+01:00" encode this correctly — but JS Date converts everything
 * to UTC internally, losing the local time. So we parse the local time directly from
 * the string instead.
 * 
 * Uses 24-hour format for consistency with international travel.
 */
export function formatTime(date: string | Date | null | undefined): string {
  if (!date) return ''
  
  // If it's a string, try to extract local time directly from ISO format
  // This preserves the local time regardless of server timezone
  if (typeof date === 'string') {
    // Match ISO 8601: ...THH:MM:SS or ...THH:MM
    const timeMatch = date.match(/T(\d{2}):(\d{2})/)
    if (timeMatch) {
      const hours = parseInt(timeMatch[1], 10)
      const minutes = timeMatch[2]
      return `${hours}:${minutes}`
    }
  }
  
  // Fallback for Date objects or non-ISO strings
  const d = new Date(date)
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
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
