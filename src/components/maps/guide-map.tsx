'use client'

import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import { latLngBounds, icon } from 'leaflet'
import { useMap } from 'react-leaflet'

interface MapEntry {
  id: string
  name: string
  category: string
  latitude: number
  longitude: number
}

interface GuideMapProps {
  entries: MapEntry[]
}

const markerIcon = icon({
  iconUrl: '/leaflet/marker-icon.png',
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  shadowUrl: '/leaflet/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

function ResizeAndFitBounds({ entries }: { entries: MapEntry[] }) {
  const map = useMap()

  useEffect(() => {
    const validBounds = latLngBounds(entries.map((entry) => [entry.latitude, entry.longitude]))
    const timer = window.setTimeout(() => {
      map.invalidateSize()
      map.fitBounds(validBounds, { padding: [36, 36], maxZoom: 15 })
    }, 0)

    return () => window.clearTimeout(timer)
  }, [entries, map])

  return null
}

export function GuideMap({ entries }: GuideMapProps) {
  const validEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          Number.isFinite(entry.latitude) &&
          Number.isFinite(entry.longitude) &&
          entry.latitude >= -90 &&
          entry.latitude <= 90 &&
          entry.longitude >= -180 &&
          entry.longitude <= 180
      ),
    [entries]
  )

  if (validEntries.length === 0) return null

  const center: [number, number] = [validEntries[0].latitude, validEntries[0].longitude]

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={false}
        className="h-[420px] w-full"
      >
        <ResizeAndFitBounds entries={validEntries} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {validEntries.map((entry) => (
          <Marker
            key={entry.id}
            position={[entry.latitude, entry.longitude]}
            icon={markerIcon}
          >
            <Popup>
              <p className="font-semibold">{entry.name}</p>
              <p className="text-sm text-gray-600">{entry.category}</p>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
