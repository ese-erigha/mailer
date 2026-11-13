import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ACTIVITY_ACTION } from './activity-action.ts'
import { CATEGORY } from './category.ts'
import { decideMailerAction } from './decide-mailer-action.ts'
import { CLASSIFY_MIN_CONFIDENCE } from './email-triage.ts'
import type { EmailTriage } from './email-triage.ts'
import { SUGGESTED_ACTION } from './suggested-action.ts'

function triage(overrides: Partial<EmailTriage> = {}): EmailTriage {
  return {
    category: CATEGORY.inquiry,
    confidence: 0.95,
    requires_followup: true,
    suggested_action: SUGGESTED_ACTION.labelOnly,
    action_items: [],
    due_on: null,
    ...overrides,
  }
}

describe('decideMailerAction', () => {
  it('when the model output is missing, then the action is needs review', () => {
    const decision = decideMailerAction(null)
    assert.equal(decision.mailerAction, ACTIVITY_ACTION.needsReview)
    assert.equal(decision.category, null)
  })

  it('when the confidence is below the threshold, then the action is needs review', () => {
    const overrides: Partial<EmailTriage> = { confidence: CLASSIFY_MIN_CONFIDENCE - 0.01 }
    const decision = decideMailerAction(triage(overrides))
    assert.equal(decision.mailerAction, ACTIVITY_ACTION.needsReview)
    assert.equal(decision.category, CATEGORY.inquiry)
  })

  it('when the model is confident, then the action is labeled', () => {
    const decision = decideMailerAction(triage())
    assert.equal(decision.mailerAction, ACTIVITY_ACTION.labeled)
    assert.equal(decision.category, CATEGORY.inquiry)
  })
})
