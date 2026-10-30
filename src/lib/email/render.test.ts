import { createElement } from 'react'
import { Body, Html, Link, Text, render, toPlainText } from '@react-email/components'
import { describe, expect, it } from 'vitest'

describe('email renderer dependency security update', () => {
  it('preserves escaped customer text and verification links in HTML and plain text', async () => {
    const html = await render(createElement(Html, null,
      createElement(Body, null,
        createElement(Text, null, '<script>alert("dummy")</script> & booking fixture'),
        createElement(Link, { href: 'https://app.example.test/verify?token_hash=dummy&type=signup' }, 'Verify fixture account'),
      ),
    ))
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('token_hash=dummy')
    const plain = toPlainText(html)
    expect(plain).toContain('booking fixture')
    expect(plain).toContain('Verify fixture account')
    expect(plain).toContain('https://app.example.test/verify?token_hash=dummy&type=signup')
  })
})
