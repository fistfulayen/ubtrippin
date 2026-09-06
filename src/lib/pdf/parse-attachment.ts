import { extractText, getDocumentProxy } from 'unpdf'

const MAX_PDF_PAGES = 50
const MAX_EXTRACTED_TEXT_CHARS = 100_000

export function hasPdfMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-'
}

export async function extractTextFromPdf(bytes: Uint8Array): Promise<string> {
  try {
    if (!hasPdfMagic(bytes)) return ''
    const pdf = await getDocumentProxy(bytes)
    if (pdf.numPages > MAX_PDF_PAGES) {
      console.error(`Refusing PDF with ${pdf.numPages} pages (max ${MAX_PDF_PAGES})`)
      return ''
    }
    const { text } = await extractText(pdf, { mergePages: true })
    return text.slice(0, MAX_EXTRACTED_TEXT_CHARS)
  } catch (error) {
    console.error('Failed to parse PDF:', error)
    return ''
  }
}

export function isValidPdfAttachment(
  attachment: { filename: string; content_type: string }
): boolean {
  return (
    attachment.content_type === 'application/pdf' ||
    attachment.filename?.toLowerCase().endsWith('.pdf')
  )
}
