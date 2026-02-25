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

export function encryptLoyaltyNumber(plaintext: string): string {
  try {
    const value = plaintext.trim()

    if (!value) {
      throw new Error('Program number cannot be empty.')
    }

    const key = getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()

    return Buffer.concat([iv, authTag, ciphertext]).toString('base64')
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to encrypt loyalty number: ${error.message}`)
    }
    throw new Error('Failed to encrypt loyalty number.')
  }
}

export function decryptLoyaltyNumber(encrypted: string): string {
  try {
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
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to decrypt loyalty number: ${error.message}`)
    }
    throw new Error('Failed to decrypt loyalty number.')
  }
}

export function maskLoyaltyNumber(plaintext: string): string {
  const value = plaintext.trim()

  if (!value) {
    throw new Error('Program number cannot be empty.')
  }

  if (value.length <= 4) {
    return '•'.repeat(value.length)
  }

  const suffix = value.slice(-4)
  const prefixLength = value.length >= 7 ? 2 : 0
  const prefix = prefixLength > 0 ? value.slice(0, prefixLength) : ''
  const maskedLength = Math.max(0, value.length - prefixLength - 4)

  return `${prefix}${'•'.repeat(maskedLength)}${suffix}`
}
