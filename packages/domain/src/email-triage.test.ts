import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { CATEGORY } from './category.ts'
import { CLASSIFY_MIN_CONFIDENCE, parseEmailTriage } from './email-triage.ts'

describe('parseEmailTriage', () => {
  it('when the model returns a complete triage, then parse returns that category', () => {
    const result = parseEmailTriage({
      category: CATEGORY.inquiry,
      confidence: 0.9,
      requires_followup: true,
      suggested_action: 'label_only',
      action_items: [],
      due_on: null,
    })
    assert.equal(result.category, CATEGORY.inquiry)
  })

  it('when the model omits the category, then parse throws', () => {
    assert.throws(() => parseEmailTriage({}))
  })

  it('when the confidence threshold is read, then it is the PRD starting value', () => {
    assert.equal(CLASSIFY_MIN_CONFIDENCE, 0.7)
  })
})
