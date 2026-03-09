'use client'

import * as React from 'react'

const CollapsibleContext = React.createContext<{
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
} | null>(null)

export function Collapsible({
  children,
  defaultOpen = false,
}: {
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <CollapsibleContext.Provider value={{ open, setOpen }}>
      <div data-state={open ? 'open' : 'closed'}>{children}</div>
    </CollapsibleContext.Provider>
  )
}

export function CollapsibleTrigger({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const context = React.useContext(CollapsibleContext)
  if (!context) throw new Error('CollapsibleTrigger must be used within Collapsible')

  return (
    <button
      type="button"
      className={className}
      aria-expanded={context.open}
      onClick={() => context.setOpen((current) => !current)}
    >
      {children}
    </button>
  )
}

export function CollapsibleContent({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const context = React.useContext(CollapsibleContext)
  if (!context) throw new Error('CollapsibleContent must be used within Collapsible')
  if (!context.open) return null

  return <div className={className}>{children}</div>
}
