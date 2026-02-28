/**
 * Typed REST API wrappers for E2E tests.
 * Uses the UBTRIPPIN v1 API directly with the test account's API key.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://www.ubtrippin.xyz'
const API_KEY = process.env.TEST_API_KEY ?? ''

function authHeaders(): HeadersInit {
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

export async function apiGet(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, { headers: authHeaders() })
  return { status: res.status, body: await parseBody(res) }
}

export async function apiPost(path: string, data: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  return { status: res.status, body: await parseBody(res) }
}

export async function apiPatch(path: string, data: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  return { status: res.status, body: await parseBody(res) }
}

export async function apiDelete(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  return { status: res.status, body: res.status === 204 ? null : await parseBody(res) }
}
