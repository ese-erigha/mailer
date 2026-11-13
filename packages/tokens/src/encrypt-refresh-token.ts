import { TOKEN_KEY_BYTES } from './refresh-token.ts'

const NONCE_BYTES = 12

export type EncryptRefreshTokenInput = {
  keyBase64: string
  accountId: string
  refreshToken: string
}

export type DecryptRefreshTokenInput = {
  keyBase64: string
  accountId: string
  encryptedRefreshToken: Uint8Array
  encryptionNonce: Uint8Array
}

export type EncryptedRefreshToken = {
  encryptedRefreshToken: Uint8Array
  encryptionNonce: Uint8Array
}

export async function encryptRefreshToken(input: EncryptRefreshTokenInput): Promise<EncryptedRefreshToken> {
  const key = await importKey(input.keyBase64)
  const encryptionNonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES))
  const algorithm = {
    name: 'AES-GCM' as const,
    iv: encryptionNonce,
    additionalData: bytes(input.accountId),
  }
  const encrypted = await crypto.subtle.encrypt(algorithm, key, bytes(input.refreshToken))
  return { encryptedRefreshToken: new Uint8Array(encrypted), encryptionNonce }
}

export async function decryptRefreshToken(input: DecryptRefreshTokenInput): Promise<string> {
  const key = await importKey(input.keyBase64)
  const algorithm = {
    name: 'AES-GCM' as const,
    iv: input.encryptionNonce,
    additionalData: bytes(input.accountId),
  }
  try {
    const plain = await crypto.subtle.decrypt(algorithm, key, input.encryptedRefreshToken)
    return new TextDecoder().decode(plain)
  } catch {
    throw new Error('The refresh token could not be decrypted.')
  }
}

async function importKey(keyBase64: string) {
  const raw = Uint8Array.from(atob(keyBase64), (char) => char.charCodeAt(0))
  if (raw.byteLength !== TOKEN_KEY_BYTES) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes.')
  }
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

function bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}
