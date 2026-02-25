/**
 * Loader for email payload fixtures.
 * Reads JSON files from e2e/fixtures/email-payloads/ and returns
 * them as typed webhook payloads for use in tests.
 */

import * as fs from 'fs'
import * as path from 'path'

const FIXTURES_DIR = path.join(__dirname, '../fixtures/email-payloads')

export interface ResendWebhookPayload {
  type: 'email.received'
  created_at: string
  data: {
    email_id: string
    from: string
    to: string[]
    subject: string
    message_id?: string
    bcc?: string[]
    cc?: string[]
  }
  _meta?: {
    provider: string
    type: string
    synthetic?: boolean
    notes?: string
  }
}

/** Load a single fixture by filename (without .json extension) */
export function loadFixture(name: string): ResendWebhookPayload {
  const filePath = path.join(FIXTURES_DIR, `${name}.json`)
  const raw = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(raw) as ResendWebhookPayload
}

/** Load all fixtures from the directory (excludes README.md) */
export function loadAllFixtures(): Array<{ name: string; payload: ResendWebhookPayload }> {
  const files = fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'))
  return files.map((file) => ({
    name: path.basename(file, '.json'),
    payload: JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, file), 'utf-8')),
  }))
}

/** Strip internal _meta key before sending as webhook payload */
export function toWebhookBody(payload: ResendWebhookPayload): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _meta, ...clean } = payload
  return JSON.stringify(clean)
}
