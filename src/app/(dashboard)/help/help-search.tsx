'use client'

import { Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

interface HelpSearchSection {
  id: string
  title: string
  searchText: string
}

interface HelpSearchProps {
  sections: HelpSearchSection[]
}

export function HelpSearch({ sections }: HelpSearchProps) {
  const [query, setQuery] = useState('')

  const normalizedQuery = query.trim().toLowerCase()

  const matchCount = useMemo(() => {
    if (!normalizedQuery) return sections.length
    return sections.filter((section) => {
      const text = `${section.title} ${section.searchText}`.toLowerCase()
      return text.includes(normalizedQuery)
    }).length
  }, [normalizedQuery, sections])

  useEffect(() => {
    sections.forEach((section) => {
      const text = `${section.title} ${section.searchText}`.toLowerCase()
      const matches = !normalizedQuery || text.includes(normalizedQuery)
      const el = document.getElementById(section.id)

      if (el) {
        el.hidden = !matches

        if (matches && normalizedQuery && el instanceof HTMLDetailsElement) {
          el.open = true
        }
      }
    })

    const noResults = document.getElementById('help-no-results')
    if (noResults) {
      noResults.hidden = matchCount > 0
    }

    window.dispatchEvent(new CustomEvent('help:query', { detail: normalizedQuery }))
  }, [matchCount, normalizedQuery, sections])

  return (
    <div className="space-y-2">
      <label htmlFor="help-search" className="text-sm font-medium text-slate-700">
        Search help articles
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          id="help-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search topics, features, or questions"
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-10 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500">
        {matchCount} section{matchCount === 1 ? '' : 's'} found
      </p>
    </div>
  )
}
