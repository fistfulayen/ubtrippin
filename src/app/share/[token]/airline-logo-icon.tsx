'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Plane } from 'lucide-react'

export function AirlineLogoIcon({ url, alt }: { url: string; alt: string }) {
  const [error, setError] = useState(false)

  if (error) {
    return <Plane className="h-4 w-4" />
  }

  return (
    <Image
      src={url}
      alt={alt}
      width={32}
      height={32}
      className="object-contain"
      onError={() => setError(true)}
    />
  )
}
