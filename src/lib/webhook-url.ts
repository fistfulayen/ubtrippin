import net from 'node:net'
import { lookup } from 'node:dns/promises'

const PRIVATE_V4_RANGES: Array<[number, number]> = [
  [ipToInt('10.0.0.0'), ipToInt('10.255.255.255')],
  [ipToInt('172.16.0.0'), ipToInt('172.31.255.255')],
  [ipToInt('192.168.0.0'), ipToInt('192.168.255.255')],
  [ipToInt('127.0.0.0'), ipToInt('127.255.255.255')],
  [ipToInt('169.254.0.0'), ipToInt('169.254.255.255')],
]

const BLOCKED_HOSTNAMES = new Set(['localhost', 'localhost.localdomain'])

function ipToInt(ip: string): number {
  return ip
    .split('.')
    .map((octet) => Number.parseInt(octet, 10))
    .reduce((acc, octet) => (acc << 8) + octet, 0) >>> 0
}

function isPrivateIpv4(ip: string): boolean {
  const value = ipToInt(ip)
  return PRIVATE_V4_RANGES.some(([start, end]) => value >= start && value <= end)
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase()
  return (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('::ffff:127.') ||
    normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:192.168.')
  )
}

function isPrivateIp(ip: string): boolean {
  const family = net.isIP(ip)
  if (family === 4) return isPrivateIpv4(ip)
  if (family === 6) return isPrivateIpv6(ip)
  return false
}

export async function validateWebhookUrl(rawUrl: string): Promise<{ ok: true; normalizedUrl: string } | { ok: false; message: string }> {
  const value = rawUrl.trim()
  if (!value) {
    return { ok: false, message: '"url" is required.' }
  }

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return { ok: false, message: '"url" must be a valid absolute URL.' }
  }

  const hostname = parsed.hostname.toLowerCase()
  const isLocalhost = BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost')

  if (parsed.protocol !== 'https:' && !(isLocalhost && parsed.protocol === 'http:')) {
    return { ok: false, message: 'Webhook URL must use HTTPS (HTTP allowed only for localhost).' }
  }

  if (!parsed.hostname) {
    return { ok: false, message: 'Webhook URL hostname is required.' }
  }

  if (parsed.username || parsed.password) {
    return { ok: false, message: 'Webhook URL must not include credentials.' }
  }

  const ipFamily = net.isIP(parsed.hostname)
  if (ipFamily > 0) {
    if (isPrivateIp(parsed.hostname)) {
      return { ok: false, message: 'Private or loopback IP addresses are not allowed.' }
    }
  } else if (!isLocalhost) {
    try {
      const resolved = await lookup(parsed.hostname, { all: true, verbatim: true })
      if (resolved.some((entry) => isPrivateIp(entry.address))) {
        return { ok: false, message: 'Webhook URL resolves to a private or loopback IP address.' }
      }
    } catch {
      return { ok: false, message: 'Webhook hostname could not be resolved.' }
    }
  }

  return { ok: true, normalizedUrl: parsed.toString() }
}
