'use client'

import { useEffect, useMemo, useState } from 'react'

interface HelpSidebarSection {
  id: string
  title: string
}

interface HelpSidebarProps {
  sections: HelpSidebarSection[]
}

export function HelpSidebar({ sections }: HelpSidebarProps) {
  const [activeId, setActiveId] = useState<string>('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    const updateFromHash = () => {
      setActiveId(window.location.hash.replace('#', ''))
    }

    updateFromHash()
    window.addEventListener('hashchange', updateFromHash)

    return () => {
      window.removeEventListener('hashchange', updateFromHash)
    }
  }, [])

  useEffect(() => {
    const handleQuery = (event: Event) => {
      const customEvent = event as CustomEvent<string>
      setQuery(customEvent.detail || '')
    }

    window.addEventListener('help:query', handleQuery)

    return () => {
      window.removeEventListener('help:query', handleQuery)
    }
  }, [])

  const visibleSections = useMemo(() => {
    if (!query) return sections
    return sections.filter((section) => section.title.toLowerCase().includes(query))
  }, [query, sections])

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-24 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">On this page</h2>
        <nav aria-label="Help sections">
          <ul className="space-y-1">
            {visibleSections.map((section) => {
              const isActive = activeId === section.id

              return (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className={[
                      'block rounded-md px-2 py-1.5 text-sm transition',
                      isActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                    ].join(' ')}
                    onClick={() => setActiveId(section.id)}
                  >
                    {section.title}
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </aside>
  )
}
