import 'server-only'

import crypto from 'crypto'

const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const raw = process.env.LOYALTY_ENCRYPTION_KEY

  if (!raw) {
    throw new Error('LOYALTY_ENCRYPTION_KEY is missing.')
  }

  const keyHex = raw.trim()

  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error('LOYALTY_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes).')
  }

  return Buffer.from(keyHex, 'hex')
}

export function encryptWebhookSecret(plaintext: string): string {
  const value = plaintext.trim()
  if (!value) {
    throw new Error('Webhook secret cannot be empty.')
  }

  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return Buffer.concat([iv, authTag, ciphertext]).toString('base64')
}

export function decryptWebhookSecret(encrypted: string): string {
  const payload = Buffer.from(encrypted, 'base64')

  if (payload.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Encrypted payload is invalid.')
  }

  const iv = payload.subarray(0, IV_LENGTH)
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const key = getEncryptionKey()
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')

  if (!plaintext) {
    throw new Error('Decrypted value is empty.')
  }

  return plaintext
}

export function maskWebhookSecret(plaintext: string): string {
  const value = plaintext.trim()
  if (!value) {
    throw new Error('Webhook secret cannot be empty.')
  }

  if (value.length <= 4) {
    return '•'.repeat(value.length)
  }

  return `${'•'.repeat(Math.max(8, value.length - 4))}${value.slice(-4)}`
}
