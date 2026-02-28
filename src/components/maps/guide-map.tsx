'use client'

import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'

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

const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

export function GuideMap({ entries }: GuideMapProps) {
  if (entries.length === 0) return null

  const center: [number, number] = [entries[0].latitude, entries[0].longitude]

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={false}
        className="h-[420px] w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {entries.map((entry) => (
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
