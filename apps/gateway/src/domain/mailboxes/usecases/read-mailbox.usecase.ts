import { ERROR_CODE } from 'mailer-domain'

import { getConfig, getRepositories } from '../../../context.ts'
import { RequestError } from '../../../http-error.ts'
import { accessEndsAt } from '../../oauth/usecases/complete-authorization.usecase.ts'

export type MailboxStatusView = {
  email: string
  status: string
  watchExpiresAt: string
  lastLabeledAt: string | null
  accessEndsAt: string | null
}

export async function readMailbox(accountId: string): Promise<MailboxStatusView> {
  const repositories = getRepositories()
  const account = await repositories.accounts.findById(accountId)
  const mailbox = await repositories.mailboxes.findByAccountId(accountId)
  if (!account || !mailbox) throw new RequestError(404, ERROR_CODE.notFound, 'The mailbox was not found.')
  const token = await repositories.oauthTokens.findByAccountId(accountId)
  const latest = await repositories.activities.findLatest(accountId)
  const endsAt = token ? accessEndsAt(token.consentedAt, getConfig().GOOGLE_APP_TESTING === 'true') : null
  return {
    email: account.gmailAddress,
    status: mailbox.status,
    watchExpiresAt: new Date(mailbox.gmailWatchExpiresAt).toISOString(),
    lastLabeledAt: latest ? new Date(latest.createdAt).toISOString() : null,
    accessEndsAt: endsAt ? new Date(endsAt).toISOString() : null,
  }
}
