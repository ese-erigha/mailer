import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { DIALECT } from './database.ts'

describe('DIALECT', () => {
  it('when the database dialect is read, then it is D1', () => {
    assert.equal(DIALECT, 'd1')
  })
})
