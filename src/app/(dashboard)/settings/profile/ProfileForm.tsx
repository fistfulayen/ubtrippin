'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

type SeatPreference = 'window' | 'aisle' | 'middle' | 'no_preference'
type MealPreference = 'standard' | 'vegetarian' | 'vegan' | 'kosher' | 'halal' | 'gluten_free' | 'no_preference'
type AlliancePreference = 'star_alliance' | 'oneworld' | 'skyteam' | 'none'

interface ProfileData {
  id: string
  seat_preference: SeatPreference
  meal_preference: MealPreference
  airline_alliance: AlliancePreference
  hotel_brand_preference: string | null
  home_airport: string | null
  currency_preference: string
  notes: string | null
  loyalty_count: number
}

interface ProfileFormProps {
  initialProfile: ProfileData
  canEditNotes: boolean
}

export function ProfileForm({ initialProfile, canEditNotes }: ProfileFormProps) {
  const [homeAirport, setHomeAirport] = useState(initialProfile.home_airport ?? '')
  const [seatPreference, setSeatPreference] = useState<SeatPreference>(initialProfile.seat_preference)
  const [mealPreference, setMealPreference] = useState<MealPreference>(initialProfile.meal_preference)
  const [airlineAlliance, setAirlineAlliance] = useState<AlliancePreference>(initialProfile.airline_alliance)
  const [hotelBrandPreference, setHotelBrandPreference] = useState(initialProfile.hotel_brand_preference ?? '')
  const [currencyPreference, setCurrencyPreference] = useState(initialProfile.currency_preference || 'USD')
  const [notes, setNotes] = useState(initialProfile.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      const response = await fetch('/api/v1/me/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          home_airport: homeAirport.trim() || null,
          seat_preference: seatPreference,
          meal_preference: mealPreference,
          airline_alliance: airlineAlliance,
          hotel_brand_preference: hotelBrandPreference.trim() || null,
          currency_preference: currencyPreference,
          notes: canEditNotes ? (notes.trim() || null) : null,
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        const errorMessage =
          (payload as { error?: { message?: string } }).error?.message ?? 'Failed to save profile.'
        setError(errorMessage)
        return
      }

      setMessage('Preferences saved.')
    } catch {
      setError('Network error while saving profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</div>}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="home_airport" className="text-sm font-medium text-gray-700">Home Airport</label>
          <Input
            id="home_airport"
            value={homeAirport}
            onChange={(event) => setHomeAirport(event.target.value)}
            placeholder="SFO"
            maxLength={8}
          />
          <p className="text-xs text-gray-500">Use IATA code when possible (for example: SFO, JFK).</p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="currency_preference" className="text-sm font-medium text-gray-700">Currency</label>
          <Select
            id="currency_preference"
            value={currencyPreference}
            onChange={(event) => setCurrencyPreference(event.target.value)}
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="CAD">CAD</option>
            <option value="AUD">AUD</option>
            <option value="JPY">JPY</option>
            <option value="INR">INR</option>
            <option value="CHF">CHF</option>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="seat_preference" className="text-sm font-medium text-gray-700">Seat Preference</label>
          <Select
            id="seat_preference"
            value={seatPreference}
            onChange={(event) => setSeatPreference(event.target.value as SeatPreference)}
          >
            <option value="window">Window</option>
            <option value="aisle">Aisle</option>
            <option value="middle">Middle</option>
            <option value="no_preference">No preference</option>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="meal_preference" className="text-sm font-medium text-gray-700">Meal Preference</label>
          <Select
            id="meal_preference"
            value={mealPreference}
            onChange={(event) => setMealPreference(event.target.value as MealPreference)}
          >
            <option value="standard">Standard</option>
            <option value="vegetarian">Vegetarian</option>
            <option value="vegan">Vegan</option>
            <option value="kosher">Kosher</option>
            <option value="halal">Halal</option>
            <option value="gluten_free">Gluten-free</option>
            <option value="no_preference">No preference</option>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="airline_alliance" className="text-sm font-medium text-gray-700">Preferred Airline Alliance</label>
          <Select
            id="airline_alliance"
            value={airlineAlliance}
            onChange={(event) => setAirlineAlliance(event.target.value as AlliancePreference)}
          >
            <option value="star_alliance">Star Alliance</option>
            <option value="oneworld">Oneworld</option>
            <option value="skyteam">SkyTeam</option>
            <option value="none">None</option>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="hotel_brand_preference" className="text-sm font-medium text-gray-700">Preferred Hotel Brand</label>
          <Input
            id="hotel_brand_preference"
            value={hotelBrandPreference}
            onChange={(event) => setHotelBrandPreference(event.target.value)}
            placeholder="Marriott"
          />
        </div>
      </div>

      {canEditNotes ? (
        <div className="space-y-1.5">
          <label htmlFor="notes" className="text-sm font-medium text-gray-700">Travel Notes</label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Any preference your agent should know (seat, pacing, chain preferences, accessibility, etc.)"
            className="min-h-[120px]"
          />
          <p className="text-xs text-gray-500">Only visible to your account and your AI agent context.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-4 text-sm text-gray-600">
          Travel Notes are available on Pro plans.
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">Saved loyalty programs: {initialProfile.loyalty_count}</p>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save Preferences'}
        </Button>
      </div>
    </form>
  )
}
