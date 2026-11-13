import { log } from 'log'
import { MAILBOX_STATUS, type MailboxEvent } from 'mailer-domain'
import { z } from 'zod'

import { getAccountQueue, getRepositories } from '../../../context.ts'

const pushBodySchema = z.object({
  emailAddress: z.string().email(),
  historyId: z.string().min(1),
})

export type AcceptGmailPushInput = {
  data: string
}

type GmailPushData = z.infer<typeof pushBodySchema>

export async function acceptGmailPush(input: AcceptGmailPushInput): Promise<void> {
  const repositories = getRepositories()
  const parsed = parsePushData(input.data)
  if (!parsed) {
    log.error('push_body_invalid')
    return
  }
  const account = await repositories.accounts.findByGmailAddress(parsed.emailAddress.toLowerCase())
  if (!account) return
  const mailbox = await repositories.mailboxes.findByAccountId(account.id)
  if (!mailbox || mailbox.status === MAILBOX_STATUS.disconnected) return
  const event: MailboxEvent = { accountId: account.id }
  await getAccountQueue().send(event)
}

function parsePushData(data: string): GmailPushData | null {
  try {
    const json = JSON.parse(atob(data.replace(/-/g, '+').replace(/_/g, '/')))
    return pushBodySchema.parse(json)
  } catch {
    return null
  }
}
