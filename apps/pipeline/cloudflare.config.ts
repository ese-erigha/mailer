import { defineConfig } from 'cf/config'
import * as entrypoint from './src/index.ts' with { type: 'cf-worker' }

export default defineConfig({
  worker: {
    name: 'mailer-pipeline',
    entrypoint,
    compatibilityDate: '2026-11-11',
  },
})
