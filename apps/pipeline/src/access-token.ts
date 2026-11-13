import { GMAIL_ERROR, GmailRequestError, refreshAccessToken, type RefreshAccessTokenInput } from 'gmail'
import { ACCESS_TOKEN_SKEW_SECONDS } from 'mailer-domain'
import { decryptRefreshToken, type DecryptRefreshTokenInput } from 'tokens'

import type { TokenCachePutOptions } from './bindings.ts'
import { getPipelineConfig, getRepositories, getTokenCache } from './context.ts'

export async function readAccessToken(accountId: string): Promise<string | null> {
  const config = getPipelineConfig()
  const cache = getTokenCache()
  const repositories = getRepositories()
  const cached = await cache.get(`access:${accountId}`)
  if (cached) return cached
  const stored = await repositories.oauthTokens.findByAccountId(accountId)
  if (!stored) return null
  const storedToken: DecryptRefreshTokenInput = {
    keyBase64: config.TOKEN_ENCRYPTION_KEY,
    accountId,
    encryptedRefreshToken: bytes(stored.encryptedRefreshToken),
    encryptionNonce: bytes(stored.encryptionNonce),
  }
  const refreshToken = await decryptRefreshToken(storedToken)
  try {
    const accessRequest: RefreshAccessTokenInput = {
      clientId: config.GOOGLE_CLIENT_ID,
      clientSecret: config.GOOGLE_CLIENT_SECRET,
      refreshToken,
    }
    const refreshed = await refreshAccessToken(accessRequest)
    const ttl = Math.max(refreshed.expiresIn - ACCESS_TOKEN_SKEW_SECONDS, 60)
    const cacheEntry: TokenCachePutOptions = { expirationTtl: ttl }
    await cache.put(`access:${accountId}`, refreshed.accessToken, cacheEntry)
    return refreshed.accessToken
  } catch (error) {
    if (error instanceof GmailRequestError && error.kind === GMAIL_ERROR.invalidGrant) {
      await repositories.oauthTokens.deleteByAccountId(accountId)
      await repositories.mailboxes.markDisconnected(accountId, Date.now())
      await cache.delete(`access:${accountId}`)
      return null
    }
    throw error
  }
}

function bytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value
  throw new Error('The stored token is not bytes.')
}
