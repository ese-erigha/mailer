import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { GMAIL_METHOD } from './allowlist.ts'

describe('GMAIL_METHOD', () => {
  it('when the client lists its methods, then the list is the allowlist', () => {
    assert.deepEqual(Object.values(GMAIL_METHOD), [
      'users.watch',
      'users.stop',
      'users.getProfile',
      'users.history.list',
      'users.messages.get',
      'users.labels.create',
      'users.labels.list',
      'users.threads.modify',
      'users.drafts.create',
    ])
  })
})
