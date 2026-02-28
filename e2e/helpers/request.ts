import type { APIResponse, APIRequestContext } from '@playwright/test'

export async function parseResponseBody(res: APIResponse): Promise<unknown> {
  const contentType = res.headers()['content-type'] ?? ''
  if (contentType.includes('application/json')) {
    try {
      return await res.json()
    } catch {
      return null
    }
  }

  try {
    const text = await res.text()
    return text || null
  } catch {
    return null
  }
}

export async function parseResponse(res: APIResponse): Promise<{ status: number; body: unknown }> {
  return {
    status: res.status(),
    body: await parseResponseBody(res),
  }
}

export async function requestJson(
  request: APIRequestContext,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  data?: unknown
): Promise<{ status: number; body: unknown }> {
  const res = await request.fetch(path, {
    method,
    ...(data === undefined
      ? {}
      : {
          headers: { 'Content-Type': 'application/json' },
          data,
        }),
  })

  return parseResponse(res)
}
