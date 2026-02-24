'use client'

import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { GUIDE_CATEGORIES } from '@/types/database'

interface EntryFormDefaults {
  name?: string
  category?: string
  status?: string
  description?: string
  address?: string
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
  defaultValues?: EntryFormDefaults
}

export function EntryForm({ action, cancelHref, defaultValues = {} }: EntryFormProps) {
  return (
    <form action={action} className="space-y-5">
      {/* Hidden source fields */}
      <input type="hidden" name="source" value={defaultValues.source ?? 'manual'} />
      {defaultValues.source_url && (
        <input type="hidden" name="source_url" value={defaultValues.source_url} />
      )}

      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Place name <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={defaultValues.name}
          placeholder="Télescope"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
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
          defaultValue={defaultValues.address}
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
          defaultValue={defaultValues.website_url}
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
              defaultValue={defaultValues.latitude}
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
              defaultValue={defaultValues.longitude}
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
