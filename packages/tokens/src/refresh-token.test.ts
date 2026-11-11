import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { TOKEN_KEY_BYTES } from './refresh-token.ts'

describe('TOKEN_KEY_BYTES', () => {
  it('when the token key length is read, then it is 32 bytes', () => {
    assert.equal(TOKEN_KEY_BYTES, 32)
  })
})
