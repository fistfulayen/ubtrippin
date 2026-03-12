'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Pencil, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { COUNTRIES, countryFlag, type CountryOption } from '../countries'
import { updateGuideMetadata } from '../actions'

interface GuideEditTitleProps {
  guideId: string
  city: string
  country: string | null
  countryCode: string | null
}

function findCountry(country: string | null, countryCode: string | null): CountryOption | null {
  if (countryCode) {
    const byCode = COUNTRIES.find((option) => option.code === countryCode.toUpperCase())
    if (byCode) return byCode
  }

  if (country) {
    const normalizedCountry = country.trim().toLowerCase()
    return (
      COUNTRIES.find((option) => option.name.toLowerCase() === normalizedCountry) ?? null
    )
  }

  return null
}

export function GuideEditTitle({
  guideId,
  city,
  country,
  countryCode,
}: GuideEditTitleProps) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [cityDraft, setCityDraft] = useState(city)
  const [countryDraft, setCountryDraft] = useState<CountryOption | null>(
    findCountry(country, countryCode)
  )
  const [countrySearch, setCountrySearch] = useState('')
  const [countryOpen, setCountryOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const displayCountryName = countryDraft?.name ?? country

  useEffect(() => {
    if (isEditing) return
    setCityDraft(city)
    setCountryDraft(findCountry(country, countryCode))
    setCountrySearch('')
    setCountryOpen(false)
    setError(null)
  }, [city, country, countryCode, isEditing])

  const filteredCountries = useMemo(() => {
    if (!countrySearch) return COUNTRIES
    const query = countrySearch.toLowerCase()
    return COUNTRIES.filter(
      (option) =>
        option.name.toLowerCase().includes(query) || option.code.toLowerCase().includes(query)
    )
  }, [countrySearch])

  const reset = () => {
    setCityDraft(city)
    setCountryDraft(findCountry(country, countryCode))
    setCountrySearch('')
    setCountryOpen(false)
    setError(null)
    setIsEditing(false)
  }

  const save = () => {
    startTransition(async () => {
      const result = await updateGuideMetadata(
        guideId,
        cityDraft,
        countryDraft?.name ?? null,
        countryDraft?.code ?? null
      )

      if (result && 'error' in result) {
        setError(result.error)
        return
      }

      setCityDraft(cityDraft.trim())
      setError(null)
      setIsEditing(false)
      router.refresh()
    })
  }

  if (isEditing) {
    return (
      <div className="max-w-xl space-y-3">
        <h1 className="sr-only">{cityDraft}</h1>
        <div className="flex items-start gap-2">
          <input
            type="text"
            value={cityDraft}
            onChange={(event) => setCityDraft(event.target.value)}
            placeholder="City"
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-2xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={isPending}
          />
          <Button size="sm" type="button" onClick={save} disabled={isPending || !cityDraft.trim()}>
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" type="button" onClick={reset} disabled={isPending}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="relative">
          <label htmlFor="guide-country-search" className="sr-only">
            Country
          </label>
          <input
            id="guide-country-search"
            type="text"
            role="combobox"
            aria-expanded={countryOpen && filteredCountries.length > 0}
            aria-controls="guide-country-listbox"
            aria-autocomplete="list"
            autoComplete="off"
            value={
              countryDraft ? `${countryFlag(countryDraft.code)} ${countryDraft.name}` : countrySearch
            }
            onChange={(event) => {
              setCountrySearch(event.target.value)
              setCountryDraft(null)
              setCountryOpen(true)
            }}
            onFocus={() => setCountryOpen(true)}
            onBlur={() => {
              setTimeout(() => setCountryOpen(false), 200)
            }}
            placeholder="Search country…"
            disabled={isPending}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {(countryDraft || countrySearch) && (
            <button
              type="button"
              onClick={() => {
                setCountryDraft(null)
                setCountrySearch('')
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}

          {countryOpen && filteredCountries.length > 0 && (
            <ul
              id="guide-country-listbox"
              role="listbox"
              className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
            >
              {filteredCountries.map((option) => (
                <li key={option.code} role="option" aria-selected={countryDraft?.code === option.code}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-indigo-50"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setCountryDraft(option)
                      setCountrySearch('')
                      setCountryOpen(false)
                    }}
                  >
                    <span>{countryFlag(option.code)}</span>
                    <span>{option.name}</span>
                    <span className="ml-auto text-xs text-gray-400">{option.code}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-start gap-2">
        <h1 className="flex items-center gap-3 text-3xl font-bold text-gray-900">
          {countryDraft?.code && <span className="text-2xl">{countryFlag(countryDraft.code)}</span>}
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded-md text-left transition-colors hover:text-indigo-700"
          >
            {cityDraft}
          </button>
        </h1>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="mt-1 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          aria-label="Edit guide title"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>

      {displayCountryName && <p className="mt-1 text-gray-500">{displayCountryName}</p>}
    </div>
  )
}
