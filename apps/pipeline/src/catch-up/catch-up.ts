import { MAILBOX_STATUS, type MailboxEvent } from 'mailer-domain'

import { getAccountQueue, getRepositories } from '../context.ts'

export async function catchUpMailboxes(): Promise<void> {
  const mailboxes = await getRepositories().mailboxes.listByStatus(MAILBOX_STATUS.connected)
  const queue = getAccountQueue()
  for (const mailbox of mailboxes) {
    const event: MailboxEvent = { accountId: mailbox.accountId }
    await queue.send(event)
  }
}
