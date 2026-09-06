/**
 * Supabase Edge Function: webhook-delivery-worker
 *
 * Processes the webhook delivery queue by calling the internal
 * process endpoint on the main app. Designed to be invoked by
 * pg_cron every 10 seconds for near-real-time webhook delivery.
 *
 * Can also be called manually or via Supabase Dashboard for testing.
 */

const APP_URL = Deno.env.get('APP_URL') || 'https://www.ubtrippin.xyz'
const CRON_SECRET = Deno.env.get('CRON_SECRET') || ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

Deno.serve(async (req: Request) => {
  const startMs = Date.now()

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json', allow: 'POST' },
    })
  }
  if (!SERVICE_ROLE_KEY || req.headers.get('authorization') !== `Bearer ${SERVICE_ROLE_KEY}`) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }
  if (!CRON_SECRET) {
    return new Response(JSON.stringify({ ok: false, error: 'Worker is not configured' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  try {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    }

    headers['authorization'] = `Bearer ${CRON_SECRET}`

    const response = await fetch(`${APP_URL}/api/internal/webhooks/process`, {
      method: 'POST',
      headers,
    })

    const body = await response.json()
    const elapsed = Date.now() - startMs

    if (!response.ok) {
      console.error(`[webhook-worker] Process endpoint returned ${response.status}:`, body)
      return new Response(
        JSON.stringify({ ok: false, status: response.status, body, elapsed_ms: elapsed }),
        { status: 502, headers: { 'content-type': 'application/json' } }
      )
    }

    const data = body.data || {}
    const idle = data.fetched === 0

    // Only log when there's actual work (reduce noise)
    if (!idle) {
      console.log(
        `[webhook-worker] Processed: ${data.processed} | ` +
        `Success: ${data.success} | Failed: ${data.failed} | ` +
        `Requeued: ${data.requeued} | Skipped: ${data.skipped} | ` +
        `${elapsed}ms`
      )
    }

    return new Response(
      JSON.stringify({ ok: true, idle, ...data, elapsed_ms: elapsed }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[webhook-worker] Fatal:', message)

    return new Response(
      JSON.stringify({ ok: false, error: message, elapsed_ms: Date.now() - startMs }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    )
  }
})
