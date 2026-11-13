import { parseMailboxEvent } from 'mailer-domain'

import { catchUpMailboxes } from './catch-up/catch-up.ts'
import { pipelineContext, pipelineStorage } from './context.ts'
import { renewWatches } from './renew-watches/renew-watches.ts'
import { MailboxSync } from './sync-mailbox/mailbox-sync.ts'
import { MailTriage } from './triage-mail/mail-triage.ts'

export { MailboxSync, MailTriage }

const RENEW_CRON = '0 */6 * * *'

type QueueMessage = { body: unknown; ack(): void }

type QueueBatch = {
  messages: QueueMessage[]
}

type CronController = {
  cron: string
}

type MailboxSyncStub = {
  sync(accountId: string): Promise<void>
}

type MailboxSyncNamespace = {
  getByName(name: string): MailboxSyncStub
}

export default {
  async queue(batch: QueueBatch, env: Record<string, unknown>): Promise<void> {
    await pipelineStorage.run(pipelineContext(env), async () => {
      for (const message of batch.messages) {
        const event = readEvent(message)
        if (!event) continue
        const namespace = env.MAILBOX_SYNC as MailboxSyncNamespace
        await namespace.getByName(event.accountId).sync(event.accountId)
        message.ack()
      }
    })
  },
  async scheduled(controller: CronController, env: Record<string, unknown>): Promise<void> {
    await pipelineStorage.run(pipelineContext(env), async () => {
      if (controller.cron === RENEW_CRON) {
        await renewWatches()
        return
      }
      await catchUpMailboxes()
    })
  },
}

function readEvent(message: QueueMessage): { accountId: string } | null {
  try {
    return parseMailboxEvent(message.body)
  } catch {
    message.ack()
    return null
  }
}
