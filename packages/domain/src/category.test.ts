import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { CATEGORY } from './category.ts'

describe('CATEGORY', () => {
  it('when the category set is read, then it contains the four triage categories', () => {
    assert.deepEqual(Object.values(CATEGORY), [
      'spam',
      'high_priority',
      'action_required',
      'inquiry',
    ])
  })
})
