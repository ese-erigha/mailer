import { DurableObject } from 'cloudflare:workers'

import { pipelineContext, pipelineStorage } from '../context.ts'
import { syncMailbox } from './sync-mailbox.ts'

export class MailboxSync extends DurableObject<Record<string, unknown>> {
  #tail: Promise<void> = Promise.resolve()

  async sync(accountId: string): Promise<void> {
    const previous = this.#tail
    let release: (value?: void) => void = () => undefined
    this.#tail = new Promise<void>((resolve) => {
      release = resolve
    })
    await previous
    const context = pipelineContext(this.env)
    await pipelineStorage.run(context, async () => {
      try {
        await syncMailbox(accountId)
      } finally {
        release()
      }
    })
  }
}
