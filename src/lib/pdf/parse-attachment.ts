import * as pdfParseModule from 'pdf-parse'

// Handle both ESM and CJS exports
const pdfParse = (pdfParseModule as { default?: typeof pdfParseModule }).default || pdfParseModule

export async function extractTextFromPdf(base64Content: string): Promise<string> {
  try {
    const buffer = Buffer.from(base64Content, 'base64')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await (pdfParse as any)(buffer)
    return data.text
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
