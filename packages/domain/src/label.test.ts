import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { LABEL } from './label.ts'

describe('LABEL', () => {
  it('when the label set is read, then each label uses the Mailer prefix', () => {
    assert.deepEqual(Object.values(LABEL), [
      'Mailer/Spam',
      'Mailer/High-Priority',
      'Mailer/Action-Required',
      'Mailer/Inquiry',
      'Mailer/Needs-Review',
      'Mailer/Drafted',
    ])
  })
})
