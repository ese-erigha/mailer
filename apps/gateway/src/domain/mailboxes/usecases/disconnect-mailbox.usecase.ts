import { refreshAccessToken, revokeRefreshToken, stopWatch, type RefreshAccessTokenInput } from 'gmail'
import { log } from 'log'
import { ERROR_CODE } from 'mailer-domain'
import { decryptRefreshToken, type DecryptRefreshTokenInput } from 'tokens'

import { getConfig, getRepositories } from '../../../context.ts'
import { RequestError } from '../../../http-error.ts'
import { requireSession } from './require-session.usecase.ts'

export type DisconnectMailboxInput = {
  token: string | undefined
  origin: string | undefined
}

export async function disconnectMailbox(input: DisconnectMailboxInput): Promise<void> {
  if (input.origin !== getConfig().APP_ORIGIN) {
    throw new RequestError(401, ERROR_CODE.unauthorized, 'The request origin is not allowed.')
  }
  const session = await requireSession(input.token)
  const repositories = getRepositories()
  const stored = await repositories.oauthTokens.findByAccountId(session.accountId)
  if (stored) await stopAndRevoke(session.accountId, stored.encryptedRefreshToken, stored.encryptionNonce)
  await repositories.accounts.deleteById(session.accountId)
}

async function stopAndRevoke(
  accountId: string,
  encryptedRefreshToken: unknown,
  encryptionNonce: unknown,
): Promise<void> {
  const config = getConfig()
  try {
    const stored: DecryptRefreshTokenInput = {
      keyBase64: config.TOKEN_ENCRYPTION_KEY,
      accountId,
      encryptedRefreshToken: bytes(encryptedRefreshToken),
      encryptionNonce: bytes(encryptionNonce),
    }
    const refreshToken = await decryptRefreshToken(stored)
    const accessRequest: RefreshAccessTokenInput = {
      clientId: config.GOOGLE_CLIENT_ID,
      clientSecret: config.GOOGLE_CLIENT_SECRET,
      refreshToken,
    }
    const access = await refreshAccessToken(accessRequest)
    await stopWatch(access.accessToken)
    await revokeRefreshToken(refreshToken)
  } catch (error) {
    const detail = error instanceof Error ? error.name : 'Error'
    log.error('disconnect_google_failed', accountId, detail)
  }
}

function bytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value
  throw new Error('The stored token is not bytes.')
}
