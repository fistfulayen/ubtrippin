import { generateText } from 'ai'

import { extractTravelData, type ExtractionResult } from './extract-travel-data'
import { selectExamples } from './example-selection'

vi.mock('ai', () => ({
  generateText: vi.fn(),
  gateway: vi.fn((model: string) => model),
}))

vi.mock('./example-selection', () => ({
  selectExamples: vi.fn(async () => []),
}))

vi.mock('./prompts', () => ({
  TRAVEL_EXTRACTION_SYSTEM_PROMPT: 'SYSTEM_PROMPT',
  buildExtractionPrompt: vi.fn(() => 'PROMPT'),
  buildSystemPromptWithExamples: vi.fn(() => 'SYSTEM_WITH_EXAMPLES'),
}))

type GenerateTextResult = Awaited<ReturnType<typeof generateText>>

function buildGenerateTextResult(text: string): GenerateTextResult {
  return { text } as unknown as GenerateTextResult
}

function makeExtractionResult(partial: Partial<ExtractionResult>): ExtractionResult {
  return {
    doc_type: 'itinerary',
    overall_confidence: 0.9,
    items: [
      {
        kind: 'flight',
        provider: 'Air France',
        confirmation_code: 'ABC123',
        traveler_names: ['Alice'],
        start_date: '2026-03-01',
        end_date: null,
        start_ts: null,
        end_ts: null,
        start_location: 'CDG',
        end_location: 'JFK',
        summary: 'AF11',
        status: 'confirmed',
        confidence: 0.9,
        needs_review: false,
        details: { flight_number: 'AF11' },
      },
    ],
    ...partial,
  }
}

describe('extractTravelData normalization', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-12-20T08:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('infers next upcoming year when extracted date omits year', async () => {
    const mockedGenerateText = vi.mocked(generateText)
    mockedGenerateText.mockResolvedValue(
      buildGenerateTextResult(
        JSON.stringify(
          makeExtractionResult({
            items: [
              {
                kind: 'flight',
                provider: 'Air France',
                confirmation_code: null,
                traveler_names: ['Alice'],
                start_date: 'Jan 5',
                end_date: null,
                start_ts: null,
                end_ts: null,
                start_location: 'CDG',
                end_location: 'JFK',
                summary: 'AF11',
                status: 'confirmed',
                confidence: 0.9,
                needs_review: false,
                details: {},
              },
            ],
          })
        )
      )
    )

    const result = await extractTravelData('Your flight Jan 5', 'See you onboard')

    expect(result.items[0].start_date).toBe('2027-01-05')
  })

  it('preserves explicit year from source text even when date is in the past', async () => {
    const mockedGenerateText = vi.mocked(generateText)
    mockedGenerateText.mockResolvedValue(
      buildGenerateTextResult(
        JSON.stringify(
          makeExtractionResult({
            items: [
              {
                kind: 'flight',
                provider: 'Air France',
                confirmation_code: null,
                traveler_names: ['Alice'],
                start_date: 'Jan 5 2026',
                end_date: null,
                start_ts: null,
                end_ts: null,
                start_location: 'CDG',
                end_location: 'JFK',
                summary: 'AF11',
                status: 'confirmed',
                confidence: 0.9,
                needs_review: false,
                details: {},
              },
            ],
          })
        )
      )
    )

    const result = await extractTravelData('Flight Jan 5 2026 confirmed', 'Booking details attached')

    expect(result.items[0].start_date).toBe('2026-01-05')
  })

  it('normalizes invalid kind and status to safe defaults', async () => {
    const mockedGenerateText = vi.mocked(generateText)
    const invalidShape = {
      doc_type: 'itinerary',
      overall_confidence: 0.9,
      items: [
        {
          kind: 'invalid_kind',
          provider: 'Unknown',
          confirmation_code: null,
          traveler_names: ['Alice'],
          start_date: '2026-03-01',
          end_date: null,
          start_ts: null,
          end_ts: null,
          start_location: null,
          end_location: null,
          summary: null,
          status: 'mystery_status',
          confidence: 0.9,
          needs_review: false,
          details: {},
        },
      ],
    }
    mockedGenerateText.mockResolvedValue(buildGenerateTextResult(JSON.stringify(invalidShape)))

    const result = await extractTravelData('subject', 'body')

    expect(result.items[0].kind).toBe('other')
    expect(result.items[0].status).toBe('unknown')
  })

  it('defaults confidence to 0.5 when out of bounds', async () => {
    const mockedGenerateText = vi.mocked(generateText)
    mockedGenerateText.mockResolvedValue(
      buildGenerateTextResult(
        JSON.stringify(
          makeExtractionResult({
            items: [
              {
                kind: 'flight',
                provider: 'Delta',
                confirmation_code: null,
                traveler_names: [],
                start_date: '2026-03-01',
                end_date: null,
                start_ts: null,
                end_ts: null,
                start_location: null,
                end_location: null,
                summary: null,
                status: 'confirmed',
                confidence: 2,
                needs_review: false,
                details: {},
              },
            ],
          })
        )
      )
    )

    const result = await extractTravelData('subject', 'body')

    expect(result.items[0].confidence).toBe(0.5)
    expect(result.items[0].needs_review).toBe(true)
  })

  it('sets needs_review when confidence is below threshold', async () => {
    const mockedGenerateText = vi.mocked(generateText)
    mockedGenerateText.mockResolvedValue(
      buildGenerateTextResult(
        JSON.stringify(
          makeExtractionResult({
            items: [
              {
                kind: 'flight',
                provider: 'Delta',
                confirmation_code: null,
                traveler_names: [],
                start_date: '2026-03-01',
                end_date: null,
                start_ts: null,
                end_ts: null,
                start_location: null,
                end_location: null,
                summary: null,
                status: 'confirmed',
                confidence: 0.4,
                needs_review: false,
                details: {},
              },
            ],
          })
        )
      )
    )

    const result = await extractTravelData('subject', 'body')

    expect(result.items[0].needs_review).toBe(true)
  })

  it('falls back start_date to reference day when date is invalid', async () => {
    const mockedGenerateText = vi.mocked(generateText)
    mockedGenerateText.mockResolvedValue(
      buildGenerateTextResult(
        JSON.stringify(
          makeExtractionResult({
            items: [
              {
                kind: 'hotel',
                provider: 'Marriott',
                confirmation_code: null,
                traveler_names: [],
                start_date: 'not-a-date',
                end_date: null,
                start_ts: null,
                end_ts: null,
                start_location: null,
                end_location: null,
                summary: null,
                status: 'confirmed',
                confidence: 0.9,
                needs_review: false,
                details: {},
              },
            ],
          })
        )
      )
    )

    const result = await extractTravelData('subject', 'body')

    expect(result.items[0].start_date).toBe('2026-12-20')
  })

  it('defaults missing traveler_names and details to safe values', async () => {
    const mockedGenerateText = vi.mocked(generateText)
    mockedGenerateText.mockResolvedValue(
      buildGenerateTextResult(
        JSON.stringify({
          doc_type: 'itinerary',
          overall_confidence: 0.8,
          items: [
            {
              kind: 'flight',
              provider: 'United',
              confirmation_code: null,
              traveler_names: 'not-an-array',
              start_date: '2026-03-01',
              end_date: null,
              start_ts: null,
              end_ts: null,
              start_location: null,
              end_location: null,
              summary: null,
              status: 'confirmed',
              confidence: 0.9,
              needs_review: false,
              details: null,
            },
          ],
        })
      )
    )

    const result = await extractTravelData('subject', 'body')

    expect(result.items[0].traveler_names).toEqual([])
    expect(result.items[0].details).toEqual({})
  })

  it('computes overall confidence average when missing', async () => {
    const mockedGenerateText = vi.mocked(generateText)
    mockedGenerateText.mockResolvedValue(
      buildGenerateTextResult(
        JSON.stringify({
          doc_type: '',
          overall_confidence: null,
          items: [
            {
              kind: 'flight',
              provider: 'AF',
              confirmation_code: null,
              traveler_names: [],
              start_date: '2026-03-01',
              end_date: null,
              start_ts: null,
              end_ts: null,
              start_location: null,
              end_location: null,
              summary: null,
              status: 'confirmed',
              confidence: 0.8,
              needs_review: false,
              details: {},
            },
            {
              kind: 'hotel',
              provider: 'Hilton',
              confirmation_code: null,
              traveler_names: [],
              start_date: '2026-03-02',
              end_date: null,
              start_ts: null,
              end_ts: null,
              start_location: null,
              end_location: null,
              summary: null,
              status: 'confirmed',
              confidence: 0.6,
              needs_review: false,
              details: {},
            },
          ],
        })
      )
    )

    const result = await extractTravelData('subject', 'body')

    expect(result.doc_type).toBe('unknown')
    expect(result.overall_confidence).toBe(0.7)
  })

  it('returns empty fallback result when AI output is invalid JSON', async () => {
    const mockedGenerateText = vi.mocked(generateText)
    mockedGenerateText.mockResolvedValue(buildGenerateTextResult('not-json'))

    const result = await extractTravelData('subject', 'body')

    expect(result).toEqual({
      doc_type: 'unknown',
      overall_confidence: 0,
      items: [],
    })
  })

  it('passes sender domain to example selection', async () => {
    const mockedGenerateText = vi.mocked(generateText)
    mockedGenerateText.mockResolvedValue(
      buildGenerateTextResult(JSON.stringify(makeExtractionResult({})))
    )

    await extractTravelData('subject', 'body', undefined, { senderDomain: 'airfrance.com' })

    expect(selectExamples).toHaveBeenCalledWith('airfrance.com')
  })
})
