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
