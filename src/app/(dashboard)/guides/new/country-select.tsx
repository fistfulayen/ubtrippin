'use client'

import { useState, useMemo } from 'react'
import { COUNTRIES, countryFlag } from '../countries'

export function CountrySelect() {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<{ name: string; code: string } | null>(null)
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    if (!search) return COUNTRIES
    const q = search.toLowerCase()
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    )
  }, [search])

  return (
    <div className="relative">
      <label htmlFor="country-search" className="block text-sm font-medium text-gray-700 mb-1">
        Country
      </label>

      {/* Hidden inputs for form submission */}
      <input type="hidden" name="country" value={selected?.name ?? ''} />
      <input type="hidden" name="country_code" value={selected?.code ?? ''} />

      <div className="relative">
        <input
          id="country-search"
          type="text"
          role="combobox"
          aria-expanded={open && !selected && filtered.length > 0}
          aria-controls="country-listbox"
          aria-autocomplete="list"
          autoComplete="off"
          value={selected ? `${countryFlag(selected.code)} ${selected.name}` : search}
          onChange={(e) => {
            setSearch(e.target.value)
            setSelected(null)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Delay to allow click on option
            setTimeout(() => setOpen(false), 200)
          }}
          placeholder="Search countries…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {selected && (
          <button
            type="button"
            onClick={() => {
              setSelected(null)
              setSearch('')
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
          >
            ✕
          </button>
        )}
      </div>

      {open && !selected && filtered.length > 0 && (
        <ul id="country-listbox" role="listbox" className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {filtered.map((c) => (
            <li key={c.code} role="option" aria-selected={false}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-indigo-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setSelected(c)
                  setSearch('')
                  setOpen(false)
                }}
              >
                <span>{countryFlag(c.code)}</span>
                <span>{c.name}</span>
                <span className="ml-auto text-xs text-gray-400">{c.code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
