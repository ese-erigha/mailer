import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { CATEGORY } from './category.ts'
import { CLASSIFY_MIN_CONFIDENCE, parseEmailTriage, type EmailTriage } from './email-triage.ts'
import { SUGGESTED_ACTION } from './suggested-action.ts'

describe('parseEmailTriage', () => {
  it('when the model returns a complete triage, then parse returns that category', () => {
    const triage: EmailTriage = {
      category: CATEGORY.inquiry,
      confidence: 0.9,
      requires_followup: true,
      suggested_action: SUGGESTED_ACTION.labelOnly,
      action_items: [],
      due_on: null,
    }
    const result = parseEmailTriage(triage)
    assert.equal(result.category, CATEGORY.inquiry)
  })

  it('when the model omits the category, then parse throws', () => {
    const triage = {}
    assert.throws(() => parseEmailTriage(triage))
  })

  it('when the confidence threshold is read, then it is the PRD starting value', () => {
    assert.equal(CLASSIFY_MIN_CONFIDENCE, 0.7)
  })
})
