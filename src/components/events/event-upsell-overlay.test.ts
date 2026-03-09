import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EventUpsellOverlay } from './event-upsell-overlay'

describe('EventUpsellOverlay', () => {
  it('renders when the free-tier overlay is visible', () => {
    const html = renderToStaticMarkup(
      React.createElement(EventUpsellOverlay, { visible: true, hiddenCount: 4 })
    )
    expect(html).toContain('Unlock the Full Calendar')
    expect(html).toContain('4 more curated events')
  })

  it('returns nothing when hidden', () => {
    const html = renderToStaticMarkup(
      React.createElement(EventUpsellOverlay, { visible: false, hiddenCount: 4 })
    )
    expect(html).toBe('')
  })
})
