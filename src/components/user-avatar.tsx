'use client'

import { useState } from 'react'

interface UserAvatarProps {
  src: string | null | undefined
  name: string | null | undefined
  email?: string | null
  size?: 'sm' | 'md' | 'lg'
}

const sizes = {
  sm: { outer: 'h-8 w-8 text-sm', img: 'h-8 w-8' },
  md: { outer: 'h-10 w-10 text-base', img: 'h-10 w-10' },
  lg: { outer: 'h-16 w-16 text-xl', img: 'h-16 w-16' },
}

export function UserAvatar({ src, name, email, size = 'sm' }: UserAvatarProps) {
  const [error, setError] = useState(false)
  const s = sizes[size]
  const initial = (name || email || '?')[0].toUpperCase()

  if (src && !error) {
    return (
      <img
        src={src}
        alt={name || 'User'}
        className={`${s.img} rounded-full`}
        onError={() => setError(true)}
        referrerPolicy="no-referrer"
      />
    )
  }

  return (
    <div className={`flex ${s.outer} items-center justify-center rounded-full bg-[#c7c2b8] text-[#1e1b4b] font-medium`}>
      {initial}
    </div>
  )
}
