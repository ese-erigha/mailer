import { bindings, defineConfig } from 'cf/config'
import * as entrypoint from './src/index.ts' with { type: 'cf-worker' }

export default defineConfig({
  worker: {
    name: 'mailer-staging-pipeline',
    entrypoint,
    compatibilityDate: '2026-11-11',
    env: {
      DB: bindings.d1({
        id: '5376ad38-6e2d-4fab-810d-b05f857b1df9',
        name: 'mailer-staging-db',
      }),
      CACHE: bindings.kv({
        id: '84421302074a41bea73194ebc9641311',
      }),
    },
  },
})
