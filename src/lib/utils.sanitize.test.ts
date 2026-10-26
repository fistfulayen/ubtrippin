import { describe, expect, it } from 'vitest'
import { sanitizeHtml } from './utils'

describe('forwarded email HTML sanitization', () => {
  it('preserves booking text, tables, formatting, and safe links', () => {
    const output = sanitizeHtml(
      '<p>Booking <strong>confirmed</strong></p>' +
      '<table><tr><td>Seat 12A</td></tr></table>' +
      '<a href="https://airline.example/booking">Manage booking</a>'
    )

    expect(output).toContain('<strong>confirmed</strong>')
    expect(output).toContain('<table>')
    expect(output).toContain('Seat 12A')
    expect(output).toContain('href="https://airline.example/booking"')
  })

  it('removes executable elements and event handlers from received email', () => {
    const output = sanitizeHtml(
      '<script>window.stolen = true</script>' +
      '<iframe src="https://attacker.example"></iframe>' +
      '<img src="x" onerror="window.stolen = true">' +
      '<p onclick="window.stolen = true">Flight confirmed</p>'
    )

    expect(output).toContain('Flight confirmed')
    expect(output).not.toMatch(/<script|<iframe|<img|onclick|onerror|window\.stolen/i)
  })

  it('rejects executable link schemes, including encoded schemes', () => {
    const output = sanitizeHtml(
      '<a href="javascript:alert(1)">First</a>' +
      '<a href="&#106;avascript:alert(1)">Second</a>' +
      '<a href="data:text/html,unsafe">Third</a>' +
      '<a href="mailto:help@airline.example">Contact</a>'
    )

    expect(output).toContain('<a>First</a>')
    expect(output).toContain('<a>Second</a>')
    expect(output).toContain('<a>Third</a>')
    expect(output).not.toMatch(/href="(?:javascript|data):/i)
    expect(output).toContain('href="mailto:help@airline.example"')
  })
})
