'use client'

import { useState } from 'react'
import { MapPin, Clock, Users, Armchair, Music, Download, ExternalLink } from 'lucide-react'

interface TicketDetails {
  event_name?: string
  venue?: string
  venue_address?: string
  event_time?: string
  door_time?: string
  section?: string
  seat?: string
  row?: string
  ticket_count?: number
  ticket_type?: string
  performer?: string
  event_category?: string
  ticket_pdf_path?: string
  apple_wallet_url?: string
  google_wallet_url?: string
  [key: string]: unknown
}

interface TicketDetailsViewProps {
  details: TicketDetails
  tripId?: string
  itemId?: string
}

// Map known ticket providers to their "manage tickets" base URLs
const PROVIDER_URLS: Record<string, string> = {
  ticketmaster: 'https://www.ticketmaster.com/my-tickets',
  'ticketmaster.fr': 'https://www.ticketmaster.fr/my-account/tickets',
  axs: 'https://www.axs.com/mytickets',
  eventbrite: 'https://www.eventbrite.com/mytickets',
  dice: 'https://dice.fm/my-tickets',
  seetickets: 'https://www.seetickets.com/mytickets',
  stubhub: 'https://www.stubhub.com/mytickets',
  viagogo: 'https://www.viagogo.com/ww/Account/Purchases',
  fnac: 'https://www.fnacspectacles.com/espace-client',
  billetreduc: 'https://www.billetreduc.com/cgi-bin/evcontact.exe?act=accueil',
}

function getProviderUrl(provider?: string | null): string | null {
  if (!provider) return null
  const key = provider.toLowerCase().replace(/\s+/g, '')
  for (const [k, url] of Object.entries(PROVIDER_URLS)) {
    if (key.includes(k) || k.includes(key)) return url
  }
  return null
}

export function TicketDetailsView({ details, tripId, itemId }: TicketDetailsViewProps) {
  const {
    event_name,
    venue,
    venue_address,
    event_time,
    door_time,
    section,
    seat,
    row,
    ticket_count,
    ticket_type,
    performer,
    event_category,
    ticket_pdf_path,
    apple_wallet_url,
    google_wallet_url,
  } = details

  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [pdfError, setPdfError] = useState(false)

  const providerUrl = getProviderUrl(details.provider as string | undefined)

  const handleDownloadPdf = async () => {
    if (!tripId || !itemId) return
    setDownloadingPdf(true)
    setPdfError(false)
    try {
      // Use redirect URL — works on mobile without popup blocker issues
      window.location.href = `/api/v1/trips/${tripId}/items/${itemId}/ticket-pdf?redirect=1`
    } catch {
      setPdfError(true)
    } finally {
      setDownloadingPdf(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-amber-50 to-gray-100 p-4">
      {/* Event name */}
      {event_name && (
        <div className="mb-3 text-lg font-semibold text-gray-900">{event_name}</div>
      )}

      {/* Performer */}
      {performer && (
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <Music className="h-4 w-4 shrink-0 text-amber-500" />
          {performer}
        </div>
      )}

      {/* Venue */}
      {venue && (
        <div className="mt-2 flex items-start gap-2 text-sm text-gray-600">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div>
            <span className="font-medium text-gray-800">{venue}</span>
            {venue_address && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue_address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 block hover:text-amber-700 hover:underline"
              >
                {venue_address}
              </a>
            )}
          </div>
        </div>
      )}

      {/* Times */}
      {(door_time || event_time) && (
        <div className="mt-4 grid grid-cols-2 gap-4">
          {door_time && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Doors
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-lg font-semibold text-gray-900">
                <Clock className="h-4 w-4 text-amber-500" />
                {door_time}
              </div>
            </div>
          )}
          {event_time && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Show
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-lg font-semibold text-gray-900">
                <Clock className="h-4 w-4 text-amber-500" />
                {event_time}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Seating */}
      {(section || row || seat) && (
        <div className="mt-4 flex items-center gap-2">
          <Armchair className="h-4 w-4 text-amber-500" />
          <div className="flex gap-3">
            {section && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-sm font-medium text-amber-700">
                Section {section}
              </span>
            )}
            {row && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-sm font-medium text-amber-700">
                Row {row}
              </span>
            )}
            {seat && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-sm font-medium text-amber-700">
                Seat {seat}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Ticket info */}
      {(ticket_count || ticket_type || event_category) && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-600">
          {ticket_count && (
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4 text-gray-400" />
              {ticket_count} {ticket_count === 1 ? 'ticket' : 'tickets'}
            </span>
          )}
          {ticket_type && (
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
              {ticket_type}
            </span>
          )}
          {event_category && (
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium capitalize text-gray-700">
              {event_category}
            </span>
          )}
        </div>
      )}

      {/* Action buttons: PDF, Wallet links, Provider */}
      {(ticket_pdf_path || apple_wallet_url || google_wallet_url || providerUrl) && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-amber-100 pt-4">
          {ticket_pdf_path && tripId && itemId && (
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              {downloadingPdf ? 'Opening…' : 'View PDF ticket'}
            </button>
          )}
          {pdfError && (
            <span className="text-xs text-red-500">Failed to load PDF. Try again.</span>
          )}
          {apple_wallet_url && (
            <a
              href={apple_wallet_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
            >
              Add to Apple Wallet
            </a>
          )}
          {google_wallet_url && (
            <a
              href={google_wallet_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Add to Google Wallet
            </a>
          )}
          {providerUrl && (
            <a
              href={providerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Manage tickets
            </a>
          )}
        </div>
      )}
    </div>
  )
}
