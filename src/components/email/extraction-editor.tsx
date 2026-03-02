'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, Save, Sparkles } from 'lucide-react'
import type { TripItemKind, TripItemStatus } from '@/types/database'

export interface ExtractedItemData {
  kind: TripItemKind
  provider: string | null
  confirmation_code: string | null
  traveler_names: string[]
  start_date: string
  end_date: string | null
  start_ts: string | null
  end_ts: string | null
  start_location: string | null
  end_location: string | null
  summary: string | null
  status: TripItemStatus
  confidence: number
  needs_review: boolean
  details: Record<string, unknown>
}

interface ExtractionEditorProps {
  items: ExtractedItemData[]
  onChange: (items: ExtractedItemData[]) => void
  onSave: (createExample: boolean) => void
  isSaving: boolean
}

const ITEM_KINDS: { value: TripItemKind; label: string }[] = [
  { value: 'flight', label: 'Flight' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'train', label: 'Train' },
  { value: 'car', label: 'Car Rental' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'activity', label: 'Activity' },
  { value: 'other', label: 'Other' },
]

const ITEM_STATUSES: { value: TripItemStatus; label: string }[] = [
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'pending', label: 'Pending' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'changed', label: 'Changed' },
  { value: 'unknown', label: 'Unknown' },
]

export function ExtractionEditor({ items, onChange, onSave, isSaving }: ExtractionEditorProps) {
  const [createExample, setCreateExample] = useState(false)

  const updateItem = (index: number, updates: Partial<ExtractedItemData>) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], ...updates }
    onChange(newItems)
  }

  const updateItemDetails = (index: number, key: string, value: string) => {
    const newItems = [...items]
    newItems[index] = {
      ...newItems[index],
      details: { ...newItems[index].details, [key]: value || undefined },
    }
    onChange(newItems)
  }

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }

  const addItem = () => {
    onChange([
      ...items,
      {
        kind: 'other',
        provider: null,
        confirmation_code: null,
        traveler_names: [],
        start_date: new Date().toISOString().split('T')[0],
        end_date: null,
        start_ts: null,
        end_ts: null,
        start_location: null,
        end_location: null,
        summary: null,
        status: 'confirmed',
        confidence: 1.0,
        needs_review: false,
        details: {},
      },
    ])
  }

  const updateTravelerNames = (index: number, value: string) => {
    const names = value.split(',').map((n) => n.trim()).filter(Boolean)
    updateItem(index, { traveler_names: names })
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <Card key={index} className="relative">
          <CardHeader className="p-4 pb-3 sm:p-6 sm:pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="font-medium">Item {index + 1}</span>
                {item.confidence < 0.65 && (
                  <span className="text-xs text-[#4f46e5] bg-[#ffffff] px-2 py-0.5 rounded">
                    Needs Review
                  </span>
                )}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeItem(index)}
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
            {/* Row 1: Kind and Status */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Type</label>
                <Select
                  value={item.kind}
                  onChange={(e) => updateItem(index, { kind: e.target.value as TripItemKind })}
                >
                  {ITEM_KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Status</label>
                <Select
                  value={item.status}
                  onChange={(e) => updateItem(index, { status: e.target.value as TripItemStatus })}
                >
                  {ITEM_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Row 2: Provider and Confirmation */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Provider</label>
                <Input
                  value={item.provider || ''}
                  onChange={(e) => updateItem(index, { provider: e.target.value || null })}
                  placeholder="e.g., Air France, Hilton"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Confirmation Code</label>
                <Input
                  value={item.confirmation_code || ''}
                  onChange={(e) => updateItem(index, { confirmation_code: e.target.value || null })}
                  placeholder="ABC123"
                  className="font-mono"
                />
              </div>
            </div>

            {/* Row 3: Dates */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Start Date</label>
                <Input
                  type="date"
                  value={item.start_date}
                  onChange={(e) => updateItem(index, { start_date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">End Date</label>
                <Input
                  type="date"
                  value={item.end_date || ''}
                  onChange={(e) => updateItem(index, { end_date: e.target.value || null })}
                />
              </div>
            </div>

            {/* Row 4: Times */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Departure Time</label>
                <Input
                  type="datetime-local"
                  value={item.start_ts?.slice(0, 16) || ''}
                  onChange={(e) => updateItem(index, { start_ts: e.target.value ? e.target.value + ':00Z' : null })}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Arrival Time</label>
                <Input
                  type="datetime-local"
                  value={item.end_ts?.slice(0, 16) || ''}
                  onChange={(e) => updateItem(index, { end_ts: e.target.value ? e.target.value + ':00Z' : null })}
                />
              </div>
            </div>

            {/* Row 5: Locations */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  {item.kind === 'flight' ? 'Departure' : 'Location'}
                </label>
                <Input
                  value={item.start_location || ''}
                  onChange={(e) => updateItem(index, { start_location: e.target.value || null })}
                  placeholder={item.kind === 'flight' ? 'CDG' : 'Address or name'}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  {item.kind === 'flight' ? 'Arrival' : 'End Location'}
                </label>
                <Input
                  value={item.end_location || ''}
                  onChange={(e) => updateItem(index, { end_location: e.target.value || null })}
                  placeholder={item.kind === 'flight' ? 'NRT' : ''}
                />
              </div>
            </div>

            {/* Travelers */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Travelers (comma-separated)</label>
              <Input
                value={item.traveler_names.join(', ')}
                onChange={(e) => updateTravelerNames(index, e.target.value)}
                placeholder="John Doe, Jane Smith"
              />
            </div>

            {/* Kind-specific details */}
            {item.kind === 'flight' && (
              <div className="grid grid-cols-1 gap-3 border-t pt-2 sm:grid-cols-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Flight Number</label>
                  <Input
                    value={(item.details?.flight_number as string) || ''}
                    onChange={(e) => updateItemDetails(index, 'flight_number', e.target.value)}
                    placeholder="AF123"
                    className="font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Airline</label>
                  <Input
                    value={(item.details?.airline as string) || ''}
                    onChange={(e) => updateItemDetails(index, 'airline', e.target.value)}
                    placeholder="Air France"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Cabin Class</label>
                  <Input
                    value={(item.details?.cabin_class as string) || ''}
                    onChange={(e) => updateItemDetails(index, 'cabin_class', e.target.value)}
                    placeholder="Economy"
                  />
                </div>
              </div>
            )}

            {item.kind === 'hotel' && (
              <div className="grid grid-cols-1 gap-3 border-t pt-2 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Room Type</label>
                  <Input
                    value={(item.details?.room_type as string) || ''}
                    onChange={(e) => updateItemDetails(index, 'room_type', e.target.value)}
                    placeholder="Deluxe King"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Check-in Time</label>
                  <Input
                    value={(item.details?.check_in_time as string) || ''}
                    onChange={(e) => updateItemDetails(index, 'check_in_time', e.target.value)}
                    placeholder="15:00"
                  />
                </div>
              </div>
            )}

            {item.kind === 'train' && (
              <div className="grid grid-cols-1 gap-3 border-t pt-2 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Train Number</label>
                  <Input
                    value={(item.details?.train_number as string) || ''}
                    onChange={(e) => updateItemDetails(index, 'train_number', e.target.value)}
                    placeholder="TGV 1234"
                    className="font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Operator</label>
                  <Input
                    value={(item.details?.operator as string) || ''}
                    onChange={(e) => updateItemDetails(index, 'operator', e.target.value)}
                    placeholder="SNCF"
                  />
                </div>
              </div>
            )}

            {/* Summary */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Summary</label>
              <Input
                value={item.summary || ''}
                onChange={(e) => updateItem(index, { summary: e.target.value || null })}
                placeholder="Brief description"
              />
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Add item button */}
      <Button variant="outline" onClick={addItem} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Add Item
      </Button>

      {/* Save section */}
      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-start gap-2 text-sm sm:items-center">
          <input
            type="checkbox"
            checked={createExample}
            onChange={(e) => setCreateExample(e.target.checked)}
            className="rounded border-gray-300 text-[#4f46e5] focus:ring-[#4f46e5]"
          />
          <Sparkles className="h-4 w-4 text-[#4f46e5]" />
          Save as learning example
        </label>
        <Button onClick={() => onSave(createExample)} disabled={isSaving} className="w-full sm:w-auto">
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Corrections'}
        </Button>
      </div>
    </div>
  )
}
