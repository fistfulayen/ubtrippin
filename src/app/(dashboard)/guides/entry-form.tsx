'use client'

import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { GUIDE_CATEGORIES } from '@/types/database'
import { searchPlaces } from './[id]/actions'

interface EntryFormDefaults {
  name?: string
  category?: string
  status?: string
  description?: string
  address?: string
  google_place_id?: string
  website_url?: string
  rating?: string
  recommended_by?: string
  latitude?: string
  longitude?: string
  source_url?: string
  source?: string
}

interface EntryFormProps {
  // Server action bound to guide/entry IDs
  action: (formData: FormData) => Promise<void>
  cancelHref: string
  guideCity: string
  defaultValues?: EntryFormDefaults
}

interface PlaceSuggestion {
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  google_place_id: string | null
  website_url: string | null
}

export function EntryForm({ action, cancelHref, guideCity, defaultValues = {} }: EntryFormProps) {
  const [nameValue, setNameValue] = useState(defaultValues.name ?? '')
  const [addressValue, setAddressValue] = useState(defaultValues.address ?? '')
  const [websiteValue, setWebsiteValue] = useState(defaultValues.website_url ?? '')
  const [latitudeValue, setLatitudeValue] = useState(defaultValues.latitude ?? '')
  const [longitudeValue, setLongitudeValue] = useState(defaultValues.longitude ?? '')
  const [googlePlaceIdValue, setGooglePlaceIdValue] = useState(defaultValues.google_place_id ?? '')
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [placesError, setPlacesError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const latestQueryRef = useRef('')

  useEffect(() => {
    const trimmed = nameValue.trim()
    if (trimmed.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      setPlacesError(null)
      return
    }

    const timeout = window.setTimeout(() => {
      const query = trimmed
      latestQueryRef.current = query
      startTransition(() => {
        void searchPlaces(query, guideCity)
          .then((results) => {
            if (latestQueryRef.current !== query) return
            if (results.length === 0) {
              setSuggestions([])
              setShowSuggestions(false)
              setPlacesError(null)
              return
            }
            setSuggestions(results)
            setShowSuggestions(true)
            setPlacesError(null)
          })
          .catch(() => {
            if (latestQueryRef.current !== query) return
            setSuggestions([])
            setShowSuggestions(false)
            setPlacesError('Places lookup unavailable. You can still enter details manually.')
          })
      })
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [guideCity, nameValue])

  const applySuggestion = (place: PlaceSuggestion) => {
    setNameValue(place.name)
    setAddressValue(place.address ?? '')
    setWebsiteValue(place.website_url ?? '')
    setLatitudeValue(place.latitude !== null ? String(place.latitude) : '')
    setLongitudeValue(place.longitude !== null ? String(place.longitude) : '')
    setGooglePlaceIdValue(place.google_place_id ?? '')
    setShowSuggestions(false)
    setSuggestions([])
    setPlacesError(null)
  }

  return (
    <form action={action} className="space-y-5">
      {/* Hidden source fields */}
      <input type="hidden" name="source" value={defaultValues.source ?? 'manual'} />
      {defaultValues.source_url && (
        <input type="hidden" name="source_url" value={defaultValues.source_url} />
      )}
      <input type="hidden" name="google_place_id" value={googlePlaceIdValue} />

      {/* Name */}
      <div className="relative">
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Place name <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          value={nameValue}
          onChange={(e) => {
            setNameValue(e.target.value)
            if (googlePlaceIdValue) setGooglePlaceIdValue('')
            setPlacesError(null)
          }}
          onFocus={() => {
            if (suggestions.length > 0) setShowSuggestions(true)
          }}
          onBlur={() => {
            window.setTimeout(() => setShowSuggestions(false), 120)
          }}
          placeholder="Télescope"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Search Google Places in {guideCity} to autofill details, or keep typing manually.
        </p>
        {isPending && nameValue.trim().length >= 2 && (
          <p className="mt-1 text-xs text-gray-500">Searching places...</p>
        )}
        {placesError && <p className="mt-1 text-xs text-amber-600">{placesError}</p>}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
            {suggestions.map((place) => (
              <button
                key={`${place.google_place_id ?? place.name}-${place.address ?? 'no-address'}`}
                type="button"
                onClick={() => applySuggestion(place)}
                className="w-full border-b border-gray-100 px-3 py-2 text-left last:border-b-0 hover:bg-gray-50"
              >
                <p className="text-sm font-medium text-gray-900">{place.name}</p>
                {place.address && <p className="text-xs text-gray-500">{place.address}</p>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Category */}
      <div>
        <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
          Category
        </label>
        <select
          id="category"
          name="category"
          defaultValue={defaultValues.category ?? 'Hidden Gems'}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {GUIDE_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Status */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="status"
              value="visited"
              defaultChecked={!defaultValues.status || defaultValues.status === 'visited'}
              className="text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">✅ Visited</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="status"
              value="to_try"
              defaultChecked={defaultValues.status === 'to_try'}
              className="text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">🔖 To Try</span>
          </label>
        </div>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          Your take
          <span className="ml-1 text-xs text-gray-400 font-normal">
            write a paragraph, not a star rating
          </span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={defaultValues.description}
          placeholder="Great espresso, tiny space on rue Villedo. The barista clearly cares more about extraction than ambiance, which is exactly right."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>

      {/* Address */}
      <div>
        <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
          Address
        </label>
        <input
          id="address"
          name="address"
          type="text"
          value={addressValue}
          onChange={(e) => setAddressValue(e.target.value)}
          placeholder="5 rue Villedo, 75001 Paris"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Website */}
      <div>
        <label htmlFor="website_url" className="block text-sm font-medium text-gray-700 mb-1">
          Website
        </label>
        <input
          id="website_url"
          name="website_url"
          type="url"
          value={websiteValue}
          onChange={(e) => setWebsiteValue(e.target.value)}
          placeholder="https://..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Rating */}
      <div>
        <label htmlFor="rating" className="block text-sm font-medium text-gray-700 mb-1">
          Rating (optional)
        </label>
        <select
          id="rating"
          name="rating"
          defaultValue={defaultValues.rating ?? ''}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">No rating</option>
          <option value="5">★★★★★ — Essential</option>
          <option value="4">★★★★ — Great</option>
          <option value="3">★★★ — Good</option>
          <option value="2">★★ — OK</option>
          <option value="1">★ — Skip</option>
        </select>
      </div>

      {/* Recommended by */}
      <div>
        <label htmlFor="recommended_by" className="block text-sm font-medium text-gray-700 mb-1">
          Recommended by
          <span className="ml-1 text-xs text-gray-400 font-normal">optional</span>
        </label>
        <input
          id="recommended_by"
          name="recommended_by"
          type="text"
          defaultValue={defaultValues.recommended_by}
          placeholder="Sarah"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Coordinates (collapsible feel — simple inputs) */}
      <details className="group">
        <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 list-none flex items-center gap-1">
          <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
          Coordinates (optional)
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="latitude" className="block text-xs font-medium text-gray-600 mb-1">
              Latitude
            </label>
            <input
              id="latitude"
              name="latitude"
              type="number"
              step="any"
              value={latitudeValue}
              onChange={(e) => setLatitudeValue(e.target.value)}
              placeholder="48.8566"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="longitude" className="block text-xs font-medium text-gray-600 mb-1">
              Longitude
            </label>
            <input
              id="longitude"
              name="longitude"
              type="number"
              step="any"
              value={longitudeValue}
              onChange={(e) => setLongitudeValue(e.target.value)}
              placeholder="2.3522"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </details>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" className="flex-1">
          Save place
        </Button>
        <Link href={cancelHref}>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  )
}
