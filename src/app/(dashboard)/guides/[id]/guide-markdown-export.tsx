'use client'

import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CityGuide, GuideEntry } from '@/types/database'

interface GuideMarkdownExportProps {
  guide: CityGuide
  entries: GuideEntry[]
}

function guideToMarkdown(guide: CityGuide, entries: GuideEntry[]): string {
  const flag = guide.country_code
    ? String.fromCodePoint(
        ...guide.country_code
          .toUpperCase()
          .split('')
          .map((c: string) => 0x1f1e6 + c.charCodeAt(0) - 65)
      )
    : ''

  const lines: string[] = []
  lines.push(`# ${flag} ${guide.city}${guide.country ? ` — ${guide.country}` : ''}`)
  lines.push(``)
  lines.push(`*${entries.filter(e => e.status === 'visited').length} places · personal guide*`)
  lines.push(``)

  const visited = entries.filter(e => e.status === 'visited')
  const grouped = visited.reduce<Record<string, GuideEntry[]>>((acc, e) => {
    if (!acc[e.category]) acc[e.category] = []
    acc[e.category].push(e)
    return acc
  }, {})

  for (const [category, catEntries] of Object.entries(grouped)) {
    lines.push(`## ${category}`)
    lines.push(``)
    for (const entry of catEntries) {
      lines.push(`### ${entry.name}`)
      if (entry.rating) {
        lines.push(`Rating: ${'★'.repeat(entry.rating)}${'☆'.repeat(5 - entry.rating)}`)
      }
      if (entry.description) lines.push(``)
      if (entry.description) lines.push(entry.description)
      if (entry.address) lines.push(``)
      if (entry.address) lines.push(`📍 ${entry.address}`)
      if (entry.website_url) lines.push(`🔗 ${entry.website_url}`)
      if (entry.recommended_by) lines.push(`*Recommended by ${entry.recommended_by}*`)
      lines.push(``)
    }
  }

  const toTry = entries.filter(e => e.status === 'to_try')
  if (toTry.length > 0) {
    lines.push(`## 🔖 To Try`)
    lines.push(``)
    for (const entry of toTry) {
      lines.push(`- **${entry.name}** (${entry.category})${entry.description ? ' — ' + entry.description : ''}${entry.recommended_by ? ` · via ${entry.recommended_by}` : ''}`)
    }
    lines.push(``)
  }

  return lines.join('\n')
}

export function GuideMarkdownExport({ guide, entries }: GuideMarkdownExportProps) {
  function handleExport() {
    const markdown = guideToMarkdown(guide, entries)
    const blob = new Blob([markdown], { type: 'text/markdown; charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${guide.city?.toLowerCase().replace(/\s+/g, '-') ?? 'guide'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      <FileText className="h-3.5 w-3.5 mr-1.5" />
      Markdown
    </Button>
  )
}
