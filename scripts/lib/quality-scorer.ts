import type { DiaryPlan, DiscoveredEventCandidate, PipelineCity, PipelineVenue, QualityAssessment } from './types'

interface AiMessage {
  role: 'system' | 'user'
  content: string
}

async function importOptionalModule(moduleName: string): Promise<unknown | null> {
  try {
    return await new Function(`return import(${JSON.stringify(moduleName)})`)()
  } catch {
    return null
  }
}

function extractJsonObject(payload: string): string {
  const trimmed = payload.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1)
  throw new Error('AI response did not contain a JSON object.')
}

async function generateJsonWithOpenAi<T>(messages: AiMessage[]): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.')

  try {
    const imported = await importOptionalModule('openai')
    if (imported && typeof imported === 'object' && 'default' in imported) {
      const OpenAI = (imported as { default: new (options: { apiKey: string }) => {
        chat: {
          completions: {
            create: (payload: unknown) => Promise<{
              choices?: Array<{ message?: { content?: string | null } }>
            }>
          }
        }
      } }).default

      const client = new OpenAI({ apiKey })
      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages,
      })

      const content = response.choices?.[0]?.message?.content
      if (!content) throw new Error('OpenAI returned an empty response.')
      return JSON.parse(extractJsonObject(content)) as T
    }
    throw new Error('OpenAI SDK is unavailable.')
  } catch (error) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`OpenAI request failed: ${response.status} ${text || response.statusText}; ${String(error)}`)
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = payload.choices?.[0]?.message?.content
    if (!content) throw new Error('OpenAI fallback returned an empty response.')
    return JSON.parse(extractJsonObject(content)) as T
  }
}

async function generateJsonWithGemini<T>(messages: AiMessage[]): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.')

  const prompt = messages.map((message) => `${message.role.toUpperCase()}:\n${message.content}`).join('\n\n')

  try {
    const imported = await importOptionalModule('@google/generative-ai')
    if (imported && typeof imported === 'object' && 'GoogleGenerativeAI' in imported) {
      const GoogleGenerativeAI = (imported as {
        GoogleGenerativeAI: new (key: string) => {
          getGenerativeModel: (input: { model: string }) => {
            generateContent: (prompt: string) => Promise<{ response: { text: () => string } }>
          }
        }
      }).GoogleGenerativeAI

      const client = new GoogleGenerativeAI(apiKey)
      const model = client.getGenerativeModel({ model: 'gemini-1.5-pro' })
      const response = await model.generateContent(`${prompt}\n\nReturn only valid JSON.`)
      const text = response.response.text()
      return JSON.parse(extractJsonObject(text)) as T
    }
    throw new Error('Gemini SDK is unavailable.')
  } catch (error) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${prompt}\n\nReturn only valid JSON.` }] }],
        }),
      }
    )

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Gemini request failed: ${response.status} ${text || response.statusText}; ${String(error)}`)
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? ''
    if (!text) throw new Error('Gemini fallback returned an empty response.')
    return JSON.parse(extractJsonObject(text)) as T
  }
}

export async function generateJson<T>(messages: AiMessage[]): Promise<T> {
  if (process.env.OPENAI_API_KEY) return generateJsonWithOpenAi<T>(messages)
  if (process.env.GEMINI_API_KEY) return generateJsonWithGemini<T>(messages)
  throw new Error('Neither OPENAI_API_KEY nor GEMINI_API_KEY is configured.')
}

function heuristicScore(candidate: DiscoveredEventCandidate, trackedVenue: PipelineVenue | null): QualityAssessment {
  const text = `${candidate.title} ${candidate.description ?? ''}`.toLowerCase()
  let score = trackedVenue?.tier ?? 45

  if (candidate.category === 'festival') score += 18
  if (candidate.category === 'art') score += 12
  if (candidate.category === 'music') score += 8
  if (candidate.image_url) score += 5
  if (candidate.booking_url) score += 5
  if (/\b(retrospective|biennale|festival|orchestra|museum|philharmonic|fashion week)\b/.test(text)) score += 20
  if (/\b(open mic|meetup|networking|karaoke|weekly|every week)\b/.test(text)) score -= 35
  if (candidate.source?.match(/eventbrite|songkick|bandsintown|timeout|visit/i)) score += 8

  const bounded = Math.max(0, Math.min(100, score))
  return {
    score: bounded,
    tier: bounded >= 80 ? 'major' : bounded >= 60 ? 'medium' : 'local',
    reasoning: 'Heuristic fallback used because no AI response was available.',
    shouldInsert: bounded >= 60,
  }
}

export async function scoreEventQuality(args: {
  city: PipelineCity
  candidate: DiscoveredEventCandidate
  trackedVenue: PipelineVenue | null
}): Promise<QualityAssessment> {
  const fallback = heuristicScore(args.candidate, args.trackedVenue)

  try {
    const result = await generateJson<{
      score: number
      tier: 'major' | 'medium' | 'local'
      reasoning: string
    }>([
      {
        role: 'system',
        content:
          'You score travel-worthy city events. Return only JSON with score (0-100), tier (major|medium|local), and reasoning.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          city: `${args.city.city}, ${args.city.country}`,
          candidate: args.candidate,
          trackedVenueTier: args.trackedVenue?.tier ?? null,
          rubric: [
            'Would a well-traveled person be disappointed to miss this?',
            'Venue significance matters.',
            'Performer recognition matters.',
            'Uniqueness and cultural importance matter.',
            'Multi-day or large-scale events score higher.',
            'Events below 60 should be rejected.',
          ],
        }),
      },
    ])

    const score = Math.max(0, Math.min(100, Math.round(result.score)))
    const tier = score >= 80 ? 'major' : score >= 60 ? 'medium' : 'local'
    return {
      score,
      tier,
      reasoning: result.reasoning,
      shouldInsert: score >= 60,
    }
  } catch {
    return fallback
  }
}

export async function extractEventFromText(args: {
  city: PipelineCity
  sourceName: string
  sourceUrl: string | null
  text: string
  fallbackDate: string | null
}): Promise<Partial<DiscoveredEventCandidate> & { isEvent: boolean }> {
  const normalizedText = args.text.trim()
  if (!normalizedText) return { isEvent: false }

  try {
    return await generateJson<Partial<DiscoveredEventCandidate> & { isEvent: boolean }>([
      {
        role: 'system',
        content:
          'Extract one event from the input. Return only JSON. If the input is not a specific event, set isEvent to false. Dates must be YYYY-MM-DD. category must be one of art,music,theater,food,festival,sports,architecture,sacred,market,other.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          city: `${args.city.city}, ${args.city.country}`,
          sourceName: args.sourceName,
          sourceUrl: args.sourceUrl,
          fallbackDate: args.fallbackDate,
          text: normalizedText.slice(0, 6000),
        }),
      },
    ])
  } catch {
    const lines = normalizedText.split(/\n+/).map((line) => line.trim()).filter(Boolean)
    const title = lines[0]?.slice(0, 180) ?? ''
    if (!title) return { isEvent: false }

    return {
      isEvent: true,
      title,
      description: lines.slice(1).join(' ').slice(0, 600),
      start_date: args.fallbackDate ?? undefined,
      end_date: args.fallbackDate ?? undefined,
      category: /museum|gallery|exhibit|expo/i.test(normalizedText)
        ? 'art'
        : /concert|orchestra|jazz|music/i.test(normalizedText)
          ? 'music'
          : /festival/i.test(normalizedText)
            ? 'festival'
            : 'other',
      venue_name: null,
      venue_type: null,
      time_info: null,
      image_url: null,
      price_info: null,
      booking_url: args.sourceUrl,
      tags: [],
      lineup: null,
      source: args.sourceName,
      source_url: args.sourceUrl,
    }
  }
}

export async function draftDiaryFromAi(input: {
  city: PipelineCity
  previousDiaryText: string | null
  summary: {
    sourcesChecked: number
    candidatesFound: number
    duplicates: number
    inserted: number
    belowThreshold: number
    sourceFailures: string[]
    sourceWins: string[]
  }
}): Promise<{ diaryText: string; nextDayPlan: DiaryPlan }> {
  const fallback: { diaryText: string; nextDayPlan: DiaryPlan } = {
    diaryText: `${input.city.city}: checked ${input.summary.sourcesChecked} sources, found ${input.summary.candidatesFound} candidates, inserted ${input.summary.inserted}, skipped ${input.summary.duplicates} duplicates, and filtered ${input.summary.belowThreshold} low-quality items.`,
    nextDayPlan: {
      summary: `Keep strong sources, retry weak coverage gaps tomorrow in ${input.city.city}.`,
      queries: [],
      sourcesToTry: [],
      sourcesToSkip: input.summary.sourceFailures,
    },
  }

  try {
    const result = await generateJson<{
      diaryText: string
      nextDayPlan: DiaryPlan
    }>([
      {
        role: 'system',
        content:
          'You write concise event-pipeline diary entries. Return JSON with diaryText and nextDayPlan {summary, queries, sourcesToTry, sourcesToSkip}.',
      },
      {
        role: 'user',
        content: JSON.stringify(input),
      },
    ])

    return {
      diaryText: result.diaryText,
      nextDayPlan: {
        summary: result.nextDayPlan?.summary ?? fallback.nextDayPlan.summary,
        queries: result.nextDayPlan?.queries ?? [],
        sourcesToTry: result.nextDayPlan?.sourcesToTry ?? [],
        sourcesToSkip: result.nextDayPlan?.sourcesToSkip ?? [],
      },
    }
  } catch {
    return fallback
  }
}
