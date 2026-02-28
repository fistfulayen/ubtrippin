'use client'

import dynamic from 'next/dynamic'

interface MapEntry {
  id: string
  name: string
  category: string
  latitude: number
  longitude: number
}

interface GuideMapSectionProps {
  entries: MapEntry[]
}

const GuideMap = dynamic(
  () => import('@/components/maps/guide-map').then((mod) => mod.GuideMap),
  { ssr: false }
)

export function GuideMapSection({ entries }: GuideMapSectionProps) {
  if (entries.length === 0) return null
  return <GuideMap entries={entries} />
}
