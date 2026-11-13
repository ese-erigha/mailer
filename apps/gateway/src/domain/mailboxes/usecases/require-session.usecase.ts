import { ERROR_CODE } from 'mailer-domain'

import { getRepositories } from '../../../context.ts'
import { RequestError } from '../../../http-error.ts'
import { sha256Hex } from '../../../session-token.ts'

export type CurrentSession = {
  accountId: string
}

export async function requireSession(token: string | undefined): Promise<CurrentSession> {
  if (!token) throw new RequestError(401, ERROR_CODE.unauthorized, 'Sign in is required.')
  const tokenHash = await sha256Hex(token)
  const session = await getRepositories().sessions.findValid(tokenHash, Date.now())
  if (!session) throw new RequestError(401, ERROR_CODE.unauthorized, 'Sign in is required.')
  return { accountId: session.accountId }
}
