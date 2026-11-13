import { bindings, defineConfig } from 'cf/config'
import * as entrypoint from './src/app.ts' with { type: 'cf-worker' }

export default defineConfig({
  worker: {
    name: 'mailer-staging-gateway',
    entrypoint,
    compatibilityDate: '2026-11-11',
    env: {
      DB: bindings.d1({
        id: '5376ad38-6e2d-4fab-810d-b05f857b1df9',
        name: 'mailer-staging-db',
      }),
      MAILBOX_EVENTS: bindings.queue({ name: 'mailer-staging-mailbox-events' }),
      APP_ORIGIN: bindings.text('https://mailer-staging-web.ese-erigha.workers.dev'),
      GOOGLE_APP_TESTING: bindings.text('true'),
      PUBSUB_TOPIC: bindings.text('mailer-staging-gmail'),
      PUBSUB_AUDIENCE: bindings.text('https://mailer-staging-gateway.ese-erigha.workers.dev/v1/gmail/push'),
    },
  },
})
