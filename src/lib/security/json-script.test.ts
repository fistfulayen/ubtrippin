import { describe, expect, it } from 'vitest'

import { serializeJsonForHtmlScript } from './json-script'

describe('serializeJsonForHtmlScript', () => {
  it('escapes closing script payloads while preserving JSON semantics', () => {
    const serialized = serializeJsonForHtmlScript({
      url: 'https://events.example/</script><script>alert(1)</script>',
    })

    expect(serialized).not.toContain('<')
    expect(serialized).not.toContain('</script>')
    expect(JSON.parse(serialized)).toEqual({
      url: 'https://events.example/</script><script>alert(1)</script>',
    })
  })
})
