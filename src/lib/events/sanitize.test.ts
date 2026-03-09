import { describe, expect, it } from 'vitest'
import { sanitizeEventFeedback } from './sanitize'

describe('sanitizeEventFeedback', () => {
  it('strips html and extracts urls', () => {
    const sanitized = sanitizeEventFeedback(
      '<script>alert(1)</script><p>Check this concert</p> https://example.com/show?ref=ubt'
    )

    expect(sanitized.sanitizedText).toBe('Check this concert https://example.com/show?ref=ubt')
    expect(sanitized.extractedUrls).toEqual(['https://example.com/show?ref=ubt'])
    expect(sanitized.extractedEvent.detectedCategory).toBe('music')
  })
})
