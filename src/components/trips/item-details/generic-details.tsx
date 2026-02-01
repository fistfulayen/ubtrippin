import type { Json } from '@/types/database'

interface GenericDetailsViewProps {
  details: Record<string, Json>
}

// Format field names: snake_case -> Title Case
function formatFieldName(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// Format values for display
function formatValue(value: Json): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function GenericDetailsView({ details }: GenericDetailsViewProps) {
  const entries = Object.entries(details).filter(
    ([, v]) => v !== null && v !== undefined && v !== ''
  )

  if (entries.length === 0) return null

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {entries.map(([key, value]) => (
          <div key={key} className="overflow-hidden">
            <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">
              {formatFieldName(key)}
            </dt>
            <dd className="mt-0.5 truncate text-sm font-medium text-gray-900">
              {formatValue(value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
