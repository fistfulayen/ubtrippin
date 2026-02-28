import crypto from 'crypto'

const { createSecretClientMock } = vi.hoisted(() => ({
  createSecretClientMock: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  createSecretClient: createSecretClientMock,
}))

import { dispatchWebhookEvent, queueWebhookTestDelivery } from './webhooks'

interface QueryResult {
  data: unknown
  error: unknown
}

interface InsertCall {
  table: string
  payload: unknown
}

interface SupabaseMockBundle {
  client: object
  inserts: InsertCall[]
}

function createSupabaseMock(
  results: QueryResult[],
  insertErrors: Partial<Record<string, unknown>> = {}
): SupabaseMockBundle {
  const queue = [...results]
  const inserts: InsertCall[] = []
  let currentTable = ''

  const next = (): QueryResult => queue.shift() ?? { data: null, error: null }

  const builder: Record<string, unknown> = {}

  const from = vi.fn((table: string) => {
    currentTable = table
    return builder
  })
  const select = vi.fn(() => builder)
  const eq = vi.fn(() => builder)
  const inOp = vi.fn(() => builder)
  const not = vi.fn(() => builder)
  const maybeSingle = vi.fn(async () => next())
  const insert = vi.fn(async (payload: unknown) => {
    inserts.push({ table: currentTable, payload })
    return { data: null, error: insertErrors[currentTable] ?? null }
  })

  const then: PromiseLike<QueryResult>['then'] = (onFulfilled, onRejected) =>
    Promise.resolve(next()).then(onFulfilled, onRejected)

  Object.assign(builder, {
    from,
    select,
    eq,
    in: inOp,
    not,
    maybeSingle,
    insert,
    then,
  })

  return {
    client: builder,
    inserts,
  }
}

describe('webhooks dispatch and queueing', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-28T15:30:45.000Z'))
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('queues webhook test delivery with deterministic payload and version=1', async () => {
    const mock = createSupabaseMock([
      {
        data: { id: 'wh-1', user_id: 'user-1', events: ['trip.created'] },
        error: null,
      },
    ])
    createSecretClientMock.mockReturnValue(mock.client)

    const result = await queueWebhookTestDelivery('wh-1', { ping: true })

    expect(result).toEqual({ queued: true })

    const deliveryInsert = mock.inserts.find((entry) => entry.table === 'webhook_deliveries')
    const queueInsert = mock.inserts.find((entry) => entry.table === 'webhook_delivery_queue')

    expect(deliveryInsert).toBeDefined()
    expect(queueInsert).toBeDefined()

    const deliveries = (deliveryInsert?.payload as Array<Record<string, unknown>>) ?? []
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0]).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      webhook_id: 'wh-1',
      event: 'ping',
      status: 'pending',
      attempts: 0,
    })

    const payload = deliveries[0].payload as Record<string, unknown>
    expect(payload).toEqual({
      version: '1',
      event: 'ping',
      webhook_id: 'wh-1',
      delivery_id: '11111111-1111-4111-8111-111111111111',
      timestamp: '2026-02-28T15:30:45.000Z',
      data: { ping: true },
    })
  })

  it('returns queued=false when webhook id is missing', async () => {
    const mock = createSupabaseMock([{ data: null, error: null }])
    createSecretClientMock.mockReturnValue(mock.client)

    const result = await queueWebhookTestDelivery('missing-id', { ping: true })

    expect(result).toEqual({ queued: false })
    expect(mock.inserts).toHaveLength(0)
  })

  it('returns queued=false when delivery insert fails', async () => {
    const mock = createSupabaseMock(
      [{ data: { id: 'wh-1', user_id: 'user-1', events: null }, error: null }],
      { webhook_deliveries: { message: 'insert failed' } }
    )
    createSecretClientMock.mockReturnValue(mock.client)

    const result = await queueWebhookTestDelivery('wh-1', { ping: true })

    expect(result).toEqual({ queued: false })
  })

  it('returns queued=false when queue insert fails', async () => {
    const mock = createSupabaseMock(
      [{ data: { id: 'wh-1', user_id: 'user-1', events: null }, error: null }],
      { webhook_delivery_queue: { message: 'queue failed' } }
    )
    createSecretClientMock.mockReturnValue(mock.client)

    const result = await queueWebhookTestDelivery('wh-1', { ping: true })

    expect(result).toEqual({ queued: false })
  })

  it('dispatches to subscribed webhooks only', async () => {
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('22222222-2222-4222-8222-222222222222')
      .mockReturnValueOnce('33333333-3333-4333-8333-333333333333')

    const mock = createSupabaseMock([
      { data: [{ user_id: 'collab-1' }], error: null },
      {
        data: [
          { id: 'wh-1', user_id: 'user-1', events: ['trip.created'] },
          { id: 'wh-2', user_id: 'collab-1', events: ['item.created'] },
        ],
        error: null,
      },
    ])
    createSecretClientMock.mockReturnValue(mock.client)

    const result = await dispatchWebhookEvent({
      userId: 'user-1',
      tripId: 'trip-1',
      event: 'trip.created',
      data: { id: 'trip-1' },
    })

    expect(result).toEqual({ webhookCount: 1, deliveryCount: 1 })

    const deliveryInsert = mock.inserts.find((entry) => entry.table === 'webhook_deliveries')
    const deliveries = (deliveryInsert?.payload as Array<Record<string, unknown>>) ?? []
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0].webhook_id).toBe('wh-1')
  })

  it('treats null events as subscribe-to-all', async () => {
    const mock = createSupabaseMock([
      {
        data: [{ id: 'wh-1', user_id: 'user-1', events: null }],
        error: null,
      },
    ])
    createSecretClientMock.mockReturnValue(mock.client)

    const result = await dispatchWebhookEvent({
      userId: 'user-1',
      event: 'item.deleted',
      data: { id: 'item-1' },
    })

    expect(result).toEqual({ webhookCount: 1, deliveryCount: 1 })
  })

  it('removes sensitive fields from payload data before queueing', async () => {
    const mock = createSupabaseMock([
      {
        data: [{ id: 'wh-1', user_id: 'user-1', events: null }],
        error: null,
      },
    ])
    createSecretClientMock.mockReturnValue(mock.client)

    await dispatchWebhookEvent({
      userId: 'user-1',
      event: 'trip.updated',
      data: {
        ok: true,
        api_key: 'should-be-removed',
        nested: {
          token: 'remove-me',
          safe: 'keep-me',
        },
      },
    })

    const deliveryInsert = mock.inserts.find((entry) => entry.table === 'webhook_deliveries')
    const deliveries = (deliveryInsert?.payload as Array<Record<string, unknown>>) ?? []
    const payload = deliveries[0].payload as Record<string, unknown>
    const data = payload.data as Record<string, unknown>
    const nested = data.nested as Record<string, unknown>

    expect(data.api_key).toBeUndefined()
    expect(nested.token).toBeUndefined()
    expect(nested.safe).toBe('keep-me')
  })

  it('returns zero counts when webhook lookup errors', async () => {
    const mock = createSupabaseMock([
      { data: [], error: null },
      { data: null, error: { message: 'query failed' } },
    ])
    createSecretClientMock.mockReturnValue(mock.client)

    const result = await dispatchWebhookEvent({
      userId: 'user-1',
      event: 'trip.created',
      data: { id: 'trip-1' },
    })

    expect(result).toEqual({ webhookCount: 0, deliveryCount: 0 })
  })
})
