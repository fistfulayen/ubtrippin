import { createGuide } from '../actions'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NewGuidePage() {
  return (
    <div className="max-w-lg mx-auto space-y-6">
      <Link
        href="/guides"
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to guides
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">New City Guide</h1>
        <p className="text-gray-600 mt-1">
          Create a guide for a city you know well (or are getting to know).
        </p>
      </div>

      <form action={createGuide} className="space-y-5">
        <div>
          <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
            City <span className="text-red-500">*</span>
          </label>
          <input
            id="city"
            name="city"
            type="text"
            required
            placeholder="Paris"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
            Country
          </label>
          <input
            id="country"
            name="country"
            type="text"
            placeholder="France"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="country_code" className="block text-sm font-medium text-gray-700 mb-1">
            Country code
            <span className="ml-1 text-xs text-gray-400">(ISO 3166-1 alpha-2, e.g. &ldquo;FR&rdquo;)</span>
          </label>
          <input
            id="country_code"
            name="country_code"
            type="text"
            maxLength={2}
            placeholder="FR"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" className="flex-1">
            Create guide
          </Button>
          <Link href="/guides">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
