export function maskEmail(email: string): string {
  const atIndex = email.indexOf('@')
  if (atIndex <= 0) return '***'
  const local = email.slice(0, atIndex)
  const domain = email.slice(atIndex + 1)
  return `${local.slice(0, 1)}***@${domain}`
}

export function maskName(name: string): string {
  if (!name) return '***'
  return `${name[0]}***`
}

export function maskId(id: string | null | undefined): string {
  if (!id) return '***'
  if (id.length <= 8) return '***'
  return `${id.slice(0, 4)}...${id.slice(-4)}`
}

export function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Unknown error'
}
