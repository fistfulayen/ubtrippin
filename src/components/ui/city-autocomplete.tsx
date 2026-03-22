'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { LocateFixed } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Prediction {
  description: string
  placeId: string
  mainText: string
}

interface CityAutocompleteProps {
  value: string
  onChange: (city: string) => void
  placeholder?: string
  className?: string
}

export function CityAutocomplete({ value, onChange, placeholder = 'Search city…', className }: CityAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value)
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Keep input in sync with controlled value from parent
  useEffect(() => {
    setInputValue(value)
  }, [value])

  const fetchPredictions = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setPredictions([])
      setOpen(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/v1/places/autocomplete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      if (!res.ok) {
        setPredictions([])
        return
      }
      const data = await res.json() as { predictions: Prediction[] }
      setPredictions(data.predictions ?? [])
      setOpen((data.predictions ?? []).length > 0)
      setActiveIndex(-1)
    } catch {
      setPredictions([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchPredictions(newValue)
    }, 300)
  }

  const handleSelect = (prediction: Prediction) => {
    setInputValue(prediction.mainText)
    onChange(prediction.mainText)
    setOpen(false)
    setPredictions([])
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => Math.min(prev + 1, predictions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && predictions[activeIndex]) {
        handleSelect(predictions[activeIndex])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const handleUseLocation = () => {
    if (!navigator.geolocation) return
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch('/api/v1/places/reverse-geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          })
          if (!res.ok) return
          const data = await res.json() as { city: string }
          if (data.city) {
            setInputValue(data.city)
            onChange(data.city)
            setOpen(false)
          }
        } finally {
          setGeoLoading(false)
        }
      },
      () => {
        setGeoLoading(false)
      }
    )
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Input
          value={inputValue}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => predictions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={handleUseLocation}
          disabled={geoLoading}
          title="Use current location"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-indigo-600 disabled:opacity-50"
        >
          <LocateFixed className={cn('h-4 w-4', geoLoading && 'animate-pulse')} />
        </button>
      </div>

      {open && predictions.length > 0 ? (
        <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md">
          {predictions.map((prediction, index) => (
            <li key={prediction.placeId}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(prediction)}
                className={cn(
                  'w-full px-3 py-2.5 text-left text-sm transition-colors',
                  index === activeIndex
                    ? 'bg-indigo-50 text-indigo-900'
                    : 'text-gray-800 hover:bg-gray-50'
                )}
              >
                <span className="font-medium">{prediction.mainText}</span>
                {prediction.description !== prediction.mainText ? (
                  <span className="ml-1 text-xs text-gray-400">
                    {prediction.description.replace(prediction.mainText, '').replace(/^,\s*/, '')}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {loading && !open ? (
        <div className="absolute right-8 top-1/2 -translate-y-1/2">
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-500" />
        </div>
      ) : null}
    </div>
  )
}
