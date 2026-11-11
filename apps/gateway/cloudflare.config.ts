import { defineConfig } from 'cf/config'
import * as entrypoint from './src/app.ts' with { type: 'cf-worker' }

export default defineConfig({
  worker: {
    name: 'mailer-gateway',
    entrypoint,
    compatibilityDate: '2026-11-11',
  },
})
