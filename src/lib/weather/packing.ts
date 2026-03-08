import { generateText, gateway } from 'ai'
import type { PackingList, TemperatureUnit, WeatherDestination } from './types'

interface PackingPromptInput {
  tripTitle: string
  destinations: WeatherDestination[]
  tempRange: { min: number; max: number; unit: '°F' | '°C' }
  travelerCount: number
}

const FALLBACK_TIP = 'You are packing for multiple moods of the atmosphere. Layers are the main character.'

export function buildPackingPrompt(input: PackingPromptInput): string {
  return JSON.stringify(
    {
      trip_title: input.tripTitle,
      destinations: input.destinations.map((destination) => ({
        city: destination.city,
        dates: `${destination.dates.start} to ${destination.dates.end}`,
        weather: {
          high: Math.round(Math.max(...destination.daily.map((day) => day.temp_high))),
          low: Math.round(Math.min(...destination.daily.map((day) => day.temp_low))),
          precip_chance: Math.round(
            Math.max(...destination.daily.map((day) => day.precipitation_probability))
          ),
          conditions: destination.daily[0]?.weather_description ?? 'Mixed bag',
        },
      })),
      temp_range: input.tempRange,
      traveler_count: input.travelerCount,
    },
    null,
    2
  )
}

function fallbackPacking(input: PackingPromptInput): PackingList {
  const hottest = input.destinations.reduce((acc, destination) => {
    const high = Math.max(...destination.daily.map((day) => day.temp_high))
    return high > acc.high ? { city: destination.city, high } : acc
  }, { city: input.destinations[0]?.city ?? 'your warm stop', high: -Infinity })

  const coldest = input.destinations.reduce((acc, destination) => {
    const low = Math.min(...destination.daily.map((day) => day.temp_low))
    return low < acc.low ? { city: destination.city, low } : acc
  }, { city: input.destinations[0]?.city ?? 'your cold stop', low: Infinity })

  return {
    essentials: ['Passport or ID', 'Phone charger', 'Medications'],
    clothing: [
      { item: `Light layers for ${hottest.city}`, reason: `${Math.round(hottest.high)}${input.tempRange.unit} and zero patience for heavy fabric.` },
      { item: `Warm outer layer for ${coldest.city}`, reason: `${Math.round(coldest.low)}${input.tempRange.unit} means your goosebumps need backup.` },
      { item: 'A rain-ready layer', reason: 'Because weather loves an ambush.' },
    ],
    footwear: ['Comfortable walking shoes', 'Weather-appropriate backup pair'],
    accessories: ['Sunglasses', 'Compact umbrella'],
    tip: FALLBACK_TIP,
  }
}

export async function generatePackingSuggestions(input: PackingPromptInput): Promise<PackingList> {
  if (input.destinations.length === 0) {
    return {
      essentials: [],
      clothing: [],
      footwear: [],
      accessories: [],
      tip: FALLBACK_TIP,
    }
  }

  const system = [
    'You create travel packing suggestions as valid JSON.',
    'Be witty, specific, and useful. Avoid bland corporate phrasing.',
    'Return keys: essentials, clothing, footwear, accessories, tip.',
    'clothing may contain either strings or { item, reason } objects.',
    'Mention the city or weather reason when it helps.',
    'No markdown. No prose outside JSON.',
  ].join(' ')

  const prompt = buildPackingPrompt(input)

  try {
    const { text } = await generateText({
      model: gateway('anthropic/claude-sonnet-4'),
      system,
      prompt,
    })

    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return fallbackPacking(input)
    const parsed = JSON.parse(match[0]) as Partial<PackingList>
    return {
      essentials: Array.isArray(parsed.essentials) ? parsed.essentials.filter(isString) : [],
      clothing: Array.isArray(parsed.clothing)
        ? parsed.clothing.filter((value) => isString(value) || isPackingObject(value))
        : [],
      footwear: Array.isArray(parsed.footwear) ? parsed.footwear.filter(isString) : [],
      accessories: Array.isArray(parsed.accessories) ? parsed.accessories.filter(isString) : [],
      tip: typeof parsed.tip === 'string' && parsed.tip.trim() ? parsed.tip.trim() : FALLBACK_TIP,
    }
  } catch {
    return fallbackPacking(input)
  }
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isPackingObject(value: unknown): value is { item: string; reason?: string | null } {
  return !!value && typeof value === 'object' && typeof (value as { item?: unknown }).item === 'string'
}

export function unitSymbol(unit: TemperatureUnit): '°F' | '°C' {
  return unit === 'celsius' ? '°C' : '°F'
}
