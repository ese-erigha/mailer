import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parseMailboxEvent } from './mailbox-event.ts'

describe('parseMailboxEvent', () => {
  it('when the queue payload has an account id, then parse returns the account id', () => {
    const body = { accountId: 'account-1' }
    const event = parseMailboxEvent(body)
    assert.equal(event.accountId, 'account-1')
  })

  it('when the account id is empty, then parse throws', () => {
    const body = { accountId: '' }
    assert.throws(() => parseMailboxEvent(body))
  })
})
