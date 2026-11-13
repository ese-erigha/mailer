import type { MailboxEvent } from 'mailer-domain'

export type AccountQueue = {
  send(body: MailboxEvent): Promise<void>
}
