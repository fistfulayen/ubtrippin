import { describe, expect, it } from 'vitest'

import { isPublicIpAddress, validatePublicUrl } from './public-http'

describe('isPublicIpAddress', () => {
  it('accepts public IPv4 and IPv6 addresses', () => {
    expect(isPublicIpAddress('8.8.8.8')).toBe(true)
    expect(isPublicIpAddress('2606:4700:4700::1111')).toBe(true)
  })

  it.each([
    '0.0.0.0',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.1.1',
    '198.18.0.1',
    '224.0.0.1',
    '::',
    '::1',
    '::ffff:127.0.0.1',
    'fc00::1',
    'fe80::1',
    '2001::1',
    '2001:db8::1',
    '2002:7f00:1::',
    'ff02::1',
  ])('rejects non-public address %s', (address) => {
    expect(isPublicIpAddress(address)).toBe(false)
  })

  it.each([
    'https://localhost/internal',
    'https://127.0.0.1/internal',
    'https://169.254.169.254/latest/meta-data',
    'https://[::1]/internal',
  ])('rejects a private literal before issuing a request: %s', async (url) => {
    await expect(validatePublicUrl(url)).rejects.toMatchObject({
      code: 'blocked_destination',
    })
  })
})
