import { parseMailboxEvent } from 'mailer-domain'

type QueueBatch = {
  messages: Array<{ body: unknown }>
}

async function consumeQueue(batch: QueueBatch): Promise<void> {
  for (const message of batch.messages) {
    parseMailboxEvent(message.body)
  }
}

export default {
  queue: consumeQueue,
}
