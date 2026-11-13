import { GMAIL_ERROR, GmailRequestError, listAddedInboxMessages, readProfile, type ListAddedInboxMessagesInput } from 'gmail'
import { log } from 'log'
import { MAILBOX_STATUS, SYNC_MAX_MESSAGES } from 'mailer-domain'

import { readAccessToken } from '../access-token.ts'
import type { StartMailTriageInput } from '../bindings.ts'
import { getRepositories, getWorkflows } from '../context.ts'
import type { MailTriageParams } from '../triage-mail/mail-triage.ts'

export async function syncMailbox(accountId: string): Promise<void> {
  const repositories = getRepositories()
  const mailbox = await repositories.mailboxes.findByAccountId(accountId)
  if (!mailbox || mailbox.status !== MAILBOX_STATUS.connected) return
  const accessToken = await readAccessToken(accountId)
  if (!accessToken) return
  let startHistoryId = mailbox.gmailHistoryId
  let capped = true
  while (capped) {
    const page = await readHistoryPage(accessToken, startHistoryId, accountId)
    if (!page) return
    for (const message of page.messages) {
      await startTriage(accountId, message.id, message.threadId)
    }
    const cursor = page.capped ? page.messages.at(-1)?.historyId ?? page.historyId : page.historyId
    await repositories.mailboxes.advanceGmailHistoryId(accountId, cursor, Date.now())
    if (cursor === startHistoryId) return
    capped = page.capped
    startHistoryId = cursor
  }
}

async function readHistoryPage(accessToken: string, startHistoryId: string, accountId: string) {
  try {
    const query: ListAddedInboxMessagesInput = { accessToken, startHistoryId, maxMessages: SYNC_MAX_MESSAGES }
    return await listAddedInboxMessages(query)
  } catch (error) {
    if (error instanceof GmailRequestError && error.kind === GMAIL_ERROR.notFound) {
      const profile = await readProfile(accessToken)
      await getRepositories().mailboxes.replaceGmailHistoryId(accountId, profile.historyId, Date.now())
      log.error('cursor_reset', accountId)
      return null
    }
    throw error
  }
}

async function startTriage(accountId: string, messageId: string, threadId: string): Promise<void> {
  try {
    const params: MailTriageParams = { accountId, messageId, threadId }
    const workflow: StartMailTriageInput = { id: `${accountId}-${messageId}`, params }
    await getWorkflows().create(workflow)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.toLowerCase().includes('already exists')) return
    throw error
  }
}
