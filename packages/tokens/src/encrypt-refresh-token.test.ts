import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { decryptRefreshToken, encryptRefreshToken, type DecryptRefreshTokenInput, type EncryptRefreshTokenInput } from './encrypt-refresh-token.ts'

const KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)))

describe('encryptRefreshToken', () => {
  it('when a refresh token is encrypted, then decrypt returns the same token', async () => {
    const stored: EncryptRefreshTokenInput = {
      keyBase64: KEY,
      accountId: 'account-1',
      refreshToken: 'refresh-token',
    }
    const encrypted = await encryptRefreshToken(stored)
    const opened: DecryptRefreshTokenInput = {
      keyBase64: KEY,
      accountId: 'account-1',
      encryptedRefreshToken: encrypted.encryptedRefreshToken,
      encryptionNonce: encrypted.encryptionNonce,
    }
    const plain = await decryptRefreshToken(opened)
    assert.equal(plain, 'refresh-token')
  })

  it('when the account id does not match, then decrypt fails', async () => {
    const stored: EncryptRefreshTokenInput = {
      keyBase64: KEY,
      accountId: 'account-1',
      refreshToken: 'refresh-token',
    }
    const encrypted = await encryptRefreshToken(stored)
    const opened: DecryptRefreshTokenInput = {
      keyBase64: KEY,
      accountId: 'account-2',
      encryptedRefreshToken: encrypted.encryptedRefreshToken,
      encryptionNonce: encrypted.encryptionNonce,
    }
    await assert.rejects(() => decryptRefreshToken(opened))
  })
})
