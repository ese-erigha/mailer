import { bindings, defineConfig, exports, triggers } from 'cf/config'
import * as entrypoint from './src/index.ts' with { type: 'cf-worker' }

export default defineConfig({
  worker: {
    name: 'mailer-staging-pipeline',
    entrypoint,
    compatibilityDate: '2026-11-11',
    exports: {
      MailboxSync: exports.durableObject({ storage: 'sqlite' }),
      MailTriage: exports.workflow({ name: 'mailer-staging-mail-triage' }),
    },
    triggers: [
      triggers.queue({
        name: 'mailer-staging-mailbox-events',
        deadLetterQueue: 'mailer-staging-mailbox-events-dlq',
        maxBatchSize: 10,
        maxRetries: 5,
        retryDelay: 30,
      }),
      triggers.scheduled({ schedule: '0 */6 * * *' }),
      triggers.scheduled({ schedule: '0 * * * *' }),
    ],
    env: {
      DB: bindings.d1({
        id: '5376ad38-6e2d-4fab-810d-b05f857b1df9',
        name: 'mailer-staging-db',
      }),
      CACHE: bindings.kv({
        id: '84421302074a41bea73194ebc9641311',
      }),
      MAILBOX_EVENTS: bindings.queue({ name: 'mailer-staging-mailbox-events' }),
      MAILBOX_SYNC: bindings.durableObject({ worker: 'mailer-staging-pipeline', exportName: 'MailboxSync' }),
      MAIL_TRIAGE: bindings.workflow({
        name: 'mailer-staging-mail-triage',
        worker: 'mailer-staging-pipeline',
        exportName: 'MailTriage',
      }),
      OPENROUTER_BASE_URL: bindings.text('https://openrouter.ai/api/v1'),
      OPENROUTER_MODEL: bindings.text('openai/gpt-4.1-mini'),
      PUBSUB_TOPIC: bindings.text('mailer-staging-gmail'),
    },
  },
})
