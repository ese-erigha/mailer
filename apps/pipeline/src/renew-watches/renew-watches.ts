import { watchInbox } from 'gmail'
import { log } from 'log'
import { MAILBOX_STATUS, WATCH_RENEW_WINDOW_HOURS } from 'mailer-domain'

import { readAccessToken } from '../access-token.ts'
import { getPipelineConfig, getRepositories } from '../context.ts'

const HOUR_MS = 60 * 60 * 1000

export async function renewWatches(): Promise<void> {
  const mailboxes = await getRepositories().mailboxes.listByStatus(MAILBOX_STATUS.connected)
  const deadline = Date.now() + WATCH_RENEW_WINDOW_HOURS * HOUR_MS
  for (const mailbox of mailboxes) {
    if (mailbox.gmailWatchExpiresAt > deadline) continue
    await renewOne(mailbox.accountId)
  }
}

async function renewOne(accountId: string): Promise<void> {
  const config = getPipelineConfig()
  try {
    const accessToken = await readAccessToken(accountId)
    if (!accessToken) return
    const watch = await watchInbox(accessToken, `projects/${config.GCP_PROJECT_ID}/topics/${config.PUBSUB_TOPIC}`)
    await getRepositories().mailboxes.updateWatchExpiry(accountId, Number(watch.expiration), Date.now())
  } catch (error) {
    const detail = error instanceof Error ? error.name : 'Error'
    log.error('watch_renew_failed', accountId, detail)
  }
}
