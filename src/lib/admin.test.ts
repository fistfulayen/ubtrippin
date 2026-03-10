import { afterEach, describe, expect, it } from 'vitest'
import { getConfiguredAdminEmails, isConfiguredAdminEmail, isFeedbackAdminEmail } from './admin'

describe('admin email helpers', () => {
  const originalFeedbackAdmins = process.env.FEEDBACK_ADMIN_EMAILS
  const originalAdmins = process.env.ADMIN_EMAILS

  afterEach(() => {
    if (originalFeedbackAdmins === undefined) {
      delete process.env.FEEDBACK_ADMIN_EMAILS
    } else {
      process.env.FEEDBACK_ADMIN_EMAILS = originalFeedbackAdmins
    }

    if (originalAdmins === undefined) {
      delete process.env.ADMIN_EMAILS
    } else {
      process.env.ADMIN_EMAILS = originalAdmins
    }
  })

  it('parses comma-separated allowlists and normalizes case', () => {
    process.env.FEEDBACK_ADMIN_EMAILS = 'Admin@Example.com, ops@example.com '

    expect(getConfiguredAdminEmails('FEEDBACK_ADMIN_EMAILS')).toEqual(
      new Set(['admin@example.com', 'ops@example.com'])
    )
    expect(isFeedbackAdminEmail(' admin@example.com ')).toBe(true)
  })

  it('falls back to ADMIN_EMAILS when the feature-specific list is unset', () => {
    delete process.env.FEEDBACK_ADMIN_EMAILS
    process.env.ADMIN_EMAILS = 'owner@example.com'

    expect(isConfiguredAdminEmail('owner@example.com', 'FEEDBACK_ADMIN_EMAILS')).toBe(true)
    expect(isFeedbackAdminEmail('user@example.com')).toBe(false)
  })
})
