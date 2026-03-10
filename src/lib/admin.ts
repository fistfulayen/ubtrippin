function parseAdminEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  )
}

export function getConfiguredAdminEmails(primaryEnvVar: string, fallbackEnvVar = 'ADMIN_EMAILS'): Set<string> {
  return parseAdminEmails(process.env[primaryEnvVar] ?? process.env[fallbackEnvVar])
}

export function isConfiguredAdminEmail(
  email: string | null | undefined,
  primaryEnvVar: string,
  fallbackEnvVar = 'ADMIN_EMAILS'
): boolean {
  const normalizedEmail = email?.trim().toLowerCase()
  if (!normalizedEmail) return false
  return getConfiguredAdminEmails(primaryEnvVar, fallbackEnvVar).has(normalizedEmail)
}

export function getFeedbackAdminEmails(): Set<string> {
  return getConfiguredAdminEmails('FEEDBACK_ADMIN_EMAILS')
}

export function isFeedbackAdminEmail(email: string | null | undefined): boolean {
  return isConfiguredAdminEmail(email, 'FEEDBACK_ADMIN_EMAILS')
}
