import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import app from './app.ts'

describe('gateway', () => {
  it('when a client calls health, then the gateway returns ok', async () => {
    const response = await app.request('/health')
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ok: true })
  })
})
