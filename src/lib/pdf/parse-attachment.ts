import { extractText, getDocumentProxy } from 'unpdf'

export async function extractTextFromPdf(base64Content: string): Promise<string> {
  try {
    const buffer = Buffer.from(base64Content, 'base64')
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const { text } = await extractText(pdf, { mergePages: true })
    return text
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
