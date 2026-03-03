/**
 * Classify PDFs from email attachments — distinguish tickets from noise.
 *
 * Noise: T&Cs, CGV, privacy policies
 * Tickets: eTicket, mTicket, boarding passes, itineraries, confirmations
 */

interface PdfAttachment {
  filename: string
  content_type: string
  buffer?: ArrayBuffer
  index: number
}

interface ClassifiedPdf extends PdfAttachment {
  is_noise: boolean
  is_ticket: boolean
  score: number // higher = more likely to be a ticket
}

// Patterns that reliably indicate NOT a ticket (case-insensitive)
const NOISE_PATTERNS = [
  /^\/?(cgv|cgu)/i,               // French T&C / Terms of Use
  /conditions[-_\s]?g[ée]n[ée]rales/i,
  /^terms/i,
  /^conditions/i,
  /^privacy/i,
  /^disclaimer/i,
  /^legal/i,
  /^policy/i,
  /^facture/i,                     // Invoice (not a ticket)
  /^receipt/i,
]

// Patterns that reliably indicate a ticket (case-insensitive), ordered by confidence
const TICKET_PATTERNS: Array<{ pattern: RegExp; score: number }> = [
  { pattern: /e-?ticket/i, score: 100 },
  { pattern: /m-?ticket/i, score: 100 },
  { pattern: /electronic[-_\s]?ticket/i, score: 95 },
  { pattern: /boarding/i, score: 90 },
  { pattern: /billet/i, score: 85 },        // French for "ticket"
  { pattern: /ticket/i, score: 80 },
  { pattern: /itinerary/i, score: 70 },
  { pattern: /confirmation/i, score: 60 },
  { pattern: /booking/i, score: 50 },
  { pattern: /reservation/i, score: 50 },
]

export function classifyPdfs(
  attachments: Array<{ filename: string; content_type: string }>,
  buffers?: ArrayBuffer[]
): ClassifiedPdf[] {
  return attachments
    .filter((a) => a.content_type === 'application/pdf')
    .map((att, i) => {
      const filename = att.filename.replace(/^\//, '') // strip leading slash
      const isNoise = NOISE_PATTERNS.some((p) => p.test(filename))

      let score = 0
      let isTicket = false
      if (!isNoise) {
        for (const { pattern, score: s } of TICKET_PATTERNS) {
          if (pattern.test(filename)) {
            score = Math.max(score, s)
            isTicket = true
          }
        }
        // If not noise and not positively identified, give it a baseline
        if (!isTicket) score = 10
      }

      return {
        filename: att.filename,
        content_type: att.content_type,
        buffer: buffers?.[i],
        index: i,
        is_noise: isNoise,
        is_ticket: isTicket,
        score,
      }
    })
    .sort((a, b) => b.score - a.score) // highest score first
}

/**
 * Select the best PDF for a ticket item from classified attachments.
 * Returns the index into the original pdfBuffers array, or -1 if none found.
 */
export function selectTicketPdfIndex(
  attachments: Array<{ filename: string; content_type: string }>,
  _buffers?: ArrayBuffer[]
): number {
  const classified = classifyPdfs(attachments)
  const candidates = classified.filter((c) => !c.is_noise)
  if (candidates.length === 0) return -1
  return candidates[0].index
}
