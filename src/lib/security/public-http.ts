import { lookup, type LookupAddress } from 'node:dns'
import http, { type IncomingHttpHeaders } from 'node:http'
import https from 'node:https'
import net, { type LookupFunction } from 'node:net'

const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_MAX_REDIRECTS = 3

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
])

const BLOCKED_IPV4_RANGES: Array<[number, number]> = [
  ['0.0.0.0', '0.255.255.255'],
  ['10.0.0.0', '10.255.255.255'],
  ['100.64.0.0', '100.127.255.255'],
  ['127.0.0.0', '127.255.255.255'],
  ['169.254.0.0', '169.254.255.255'],
  ['172.16.0.0', '172.31.255.255'],
  ['192.0.0.0', '192.0.0.255'],
  ['192.0.2.0', '192.0.2.255'],
  ['192.88.99.0', '192.88.99.255'],
  ['192.168.0.0', '192.168.255.255'],
  ['198.18.0.0', '198.19.255.255'],
  ['198.51.100.0', '198.51.100.255'],
  ['203.0.113.0', '203.0.113.255'],
  ['224.0.0.0', '255.255.255.255'],
].map(([start, end]) => [ipv4ToInt(start), ipv4ToInt(end)])

function ipv4ToInt(ip: string): number {
  return ip
    .split('.')
    .map((octet) => Number.parseInt(octet, 10))
    .reduce((acc, octet) => (acc * 256) + octet, 0) >>> 0
}

function normalizedIpLiteral(value: string): string {
  return value.startsWith('[') && value.endsWith(']') ? value.slice(1, -1) : value
}

function mappedIpv4(ip: string): string | null {
  const match = ip.toLowerCase().match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)
  return match?.[1] ?? null
}

/** True only for globally routable unicast addresses. */
export function isPublicIpAddress(rawAddress: string): boolean {
  const address = normalizedIpLiteral(rawAddress)
  const family = net.isIP(address)

  if (family === 4) {
    const value = ipv4ToInt(address)
    return !BLOCKED_IPV4_RANGES.some(([start, end]) => value >= start && value <= end)
  }

  if (family === 6) {
    const mapped = mappedIpv4(address)
    if (mapped) return isPublicIpAddress(mapped)

    const normalized = address.toLowerCase()
    const firstGroup = Number.parseInt(normalized.split(':')[0] || '0', 16)

    // Accept only native IPv6 global-unicast space. Transition/documentation
    // ranges can route through infrastructure whose ultimate IPv4 target is
    // not represented by this address, so treat those as non-public too.
    return (
      firstGroup >= 0x2000 &&
      firstGroup <= 0x3fff &&
      !normalized.startsWith('2001::') &&
      !normalized.startsWith('2001:0000:') &&
      !normalized.startsWith('2001:0:') &&
      !normalized.startsWith('2001:db8:') &&
      normalized !== '2001:db8::' &&
      !normalized.startsWith('2002:')
    )
  }

  return false
}

export class PublicHttpError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'invalid_url'
      | 'blocked_destination'
      | 'dns_failure'
      | 'redirect_limit'
      | 'timeout'
      | 'body_too_large'
      | 'request_failure'
  ) {
    super(message)
    this.name = 'PublicHttpError'
  }
}

function parseUrl(rawUrl: string, allowHttp: boolean): URL {
  let parsed: URL
  try {
    parsed = new URL(rawUrl.trim())
  } catch {
    throw new PublicHttpError('URL must be a valid absolute URL.', 'invalid_url')
  }

  if (parsed.protocol !== 'https:' && !(allowHttp && parsed.protocol === 'http:')) {
    throw new PublicHttpError(
      allowHttp ? 'URL must use HTTP or HTTPS.' : 'URL must use HTTPS.',
      'invalid_url'
    )
  }
  if (!parsed.hostname || parsed.username || parsed.password) {
    throw new PublicHttpError('URL must have a hostname and no credentials.', 'invalid_url')
  }

  const hostname = normalizedIpLiteral(parsed.hostname).toLowerCase()
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost')) {
    throw new PublicHttpError('Local and metadata destinations are not allowed.', 'blocked_destination')
  }

  return parsed
}

function resolveHostname(hostname: string): Promise<LookupAddress[]> {
  const literal = normalizedIpLiteral(hostname)
  const family = net.isIP(literal)
  if (family) return Promise.resolve([{ address: literal, family }])

  return new Promise((resolve, reject) => {
    lookup(literal, { all: true, verbatim: true }, (error, addresses) => {
      if (error || addresses.length === 0) {
        reject(new PublicHttpError('Hostname could not be resolved.', 'dns_failure'))
        return
      }
      resolve(addresses)
    })
  })
}

async function resolvePublicDestination(parsed: URL): Promise<LookupAddress> {
  const addresses = await resolveHostname(parsed.hostname)
  if (addresses.some(({ address }) => !isPublicIpAddress(address))) {
    throw new PublicHttpError(
      'Destination resolves to a non-public IP address.',
      'blocked_destination'
    )
  }
  return addresses[0]
}

async function resolvePublicDestinationBefore(
  parsed: URL,
  deadline: number
): Promise<LookupAddress> {
  const remainingMs = deadline - Date.now()
  if (remainingMs <= 0) {
    throw new PublicHttpError('Request timed out.', 'timeout')
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      resolvePublicDestination(parsed),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new PublicHttpError('DNS lookup timed out.', 'timeout')),
          remainingMs
        )
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function validatePublicUrl(
  rawUrl: string,
  options: { allowHttp?: boolean } = {}
): Promise<string> {
  const parsed = parseUrl(rawUrl, options.allowHttp === true)
  await resolvePublicDestinationBefore(parsed, Date.now() + DEFAULT_TIMEOUT_MS)
  return parsed.toString()
}

export interface PublicHttpResponse {
  url: string
  status: number
  headers: IncomingHttpHeaders
  body: Uint8Array
}

export interface PublicHttpRequestOptions {
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string | Uint8Array
  allowHttp?: boolean
  maxRedirects?: number
  maxResponseBytes: number
  timeoutMs?: number
}

interface SingleResponse extends PublicHttpResponse {
  redirectLocation: string | null
}

async function requestOnce(
  parsed: URL,
  pinnedAddress: LookupAddress,
  options: PublicHttpRequestOptions,
  timeoutMs: number
): Promise<SingleResponse> {
  return new Promise((resolve, reject) => {
    let settled = false
    const client = parsed.protocol === 'https:' ? https : http
    const pinnedLookup: LookupFunction = (_hostname, _options, callback) => {
      callback(null, pinnedAddress.address, pinnedAddress.family)
    }

    const request = client.request(parsed, {
      method: options.method ?? 'GET',
      headers: options.headers,
      lookup: pinnedLookup,
    })

    const finishWithError = (error: PublicHttpError) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      request.destroy()
      reject(error)
    }

    const timer = setTimeout(() => {
      finishWithError(new PublicHttpError('Request timed out.', 'timeout'))
    }, timeoutMs)

    request.on('response', (response) => {
      const status = response.statusCode ?? 0
      const location = response.headers.location
      const isRedirect = status >= 300 && status < 400 && typeof location === 'string'

      if (isRedirect) {
        settled = true
        clearTimeout(timer)
        response.destroy()
        resolve({
          url: parsed.toString(),
          status,
          headers: response.headers,
          body: new Uint8Array(),
          redirectLocation: location,
        })
        return
      }

      if (options.maxResponseBytes === 0) {
        settled = true
        clearTimeout(timer)
        response.destroy()
        resolve({
          url: parsed.toString(),
          status,
          headers: response.headers,
          body: new Uint8Array(),
          redirectLocation: null,
        })
        return
      }

      const declaredLength = Number(response.headers['content-length'])
      if (Number.isFinite(declaredLength) && declaredLength > options.maxResponseBytes) {
        response.destroy()
        finishWithError(new PublicHttpError('Response body is too large.', 'body_too_large'))
        return
      }

      const chunks: Buffer[] = []
      let receivedBytes = 0

      response.on('data', (chunk: Buffer) => {
        receivedBytes += chunk.length
        if (receivedBytes > options.maxResponseBytes) {
          response.destroy()
          finishWithError(new PublicHttpError('Response body is too large.', 'body_too_large'))
          return
        }
        chunks.push(chunk)
      })
      response.on('end', () => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve({
          url: parsed.toString(),
          status,
          headers: response.headers,
          body: new Uint8Array(Buffer.concat(chunks)),
          redirectLocation: null,
        })
      })
      response.on('error', (error) => {
        finishWithError(new PublicHttpError(error.message, 'request_failure'))
      })
    })
    request.on('error', (error) => {
      finishWithError(
        error instanceof PublicHttpError
          ? error
          : new PublicHttpError(error.message, 'request_failure')
      )
    })

    if (options.body !== undefined) request.write(options.body)
    request.end()
  })
}

/**
 * Fetch a public HTTP(S) resource with DNS pinning, per-hop validation,
 * bounded redirects, a whole-response deadline, and a strict byte cap.
 */
export async function requestPublicUrl(
  rawUrl: string,
  options: PublicHttpRequestOptions
): Promise<PublicHttpResponse> {
  if (!Number.isSafeInteger(options.maxResponseBytes) || options.maxResponseBytes < 0) {
    throw new PublicHttpError('Response byte limit must be a non-negative integer.', 'request_failure')
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const deadline = Date.now() + timeoutMs
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS
  let parsed = parseUrl(rawUrl, options.allowHttp === true)

  for (let redirectCount = 0; ; redirectCount += 1) {
    const pinnedAddress = await resolvePublicDestinationBefore(parsed, deadline)
    const remainingMs = deadline - Date.now()
    if (remainingMs <= 0) throw new PublicHttpError('Request timed out.', 'timeout')
    const response = await requestOnce(parsed, pinnedAddress, options, remainingMs)
    if (!response.redirectLocation) return response

    if (redirectCount >= maxRedirects) {
      throw new PublicHttpError('Too many redirects.', 'redirect_limit')
    }

    parsed = parseUrl(
      new URL(response.redirectLocation, parsed).toString(),
      options.allowHttp === true
    )
  }
}

export function getHeaderValue(headers: IncomingHttpHeaders, name: string): string {
  const value = headers[name.toLowerCase()]
  return Array.isArray(value) ? value.join(', ') : value ?? ''
}
