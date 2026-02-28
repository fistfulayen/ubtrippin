/**
 * Typed REST API wrappers for E2E tests.
 * Uses the UBTRIPPIN v1 API directly with the test account's API key.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://www.ubtrippin.xyz'
const API_KEY = process.env.TEST_API_KEY ?? ''

type AuthMode = 'apiKey' | 'none'

interface ApiRequestOptions {
  auth?: AuthMode
  headers?: HeadersInit
}

function authHeaders(auth: AuthMode): HeadersInit {
  if (auth === 'none') {
    return {
      'Content-Type': 'application/json',
    }
  }

  return {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  }
}

async function parseBody(res: Response) {
  const ct = res.headers.get('content-type') ?? ''
  if (ct.includes('application/json')) {
    try { return await res.json() } catch { return null }
  }
  return null
}

async function request(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  data?: unknown,
  options: ApiRequestOptions = {}
) {
  const auth = options.auth ?? 'apiKey'
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...authHeaders(auth),
      ...(options.headers ?? {}),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  })

  return {
    status: res.status,
    body: res.status === 204 ? null : await parseBody(res),
  }
}

export async function apiGet(path: string, options?: ApiRequestOptions) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      ...authHeaders(options?.auth ?? 'apiKey'),
      ...(options?.headers ?? {}),
    },
  })
  return { status: res.status, body: await parseBody(res) }
}

export async function apiPost(path: string, data: unknown, options?: ApiRequestOptions) {
  return request(path, 'POST', data, options)
}

export async function apiPatch(path: string, data: unknown, options?: ApiRequestOptions) {
  return request(path, 'PATCH', data, options)
}

export async function apiDelete(path: string, options?: ApiRequestOptions) {
  return request(path, 'DELETE', undefined, options)
}
