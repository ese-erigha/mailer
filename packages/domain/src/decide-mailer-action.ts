import { ACTIVITY_ACTION, type ActivityAction } from './activity-action.ts'
import { CLASSIFY_MIN_CONFIDENCE } from './email-triage.ts'
import type { Category } from './category.ts'
import type { EmailTriage } from './email-triage.ts'
import { SUGGESTED_ACTION } from './suggested-action.ts'

export type MailerDecision = {
  mailerAction: ActivityAction
  category: Category | null
  modelConfidence: number | null
}

export function decideMailerAction(triage: EmailTriage | null): MailerDecision {
  if (!triage) {
    return { mailerAction: ACTIVITY_ACTION.needsReview, category: null, modelConfidence: null }
  }
  const belowConfidence = triage.confidence < CLASSIFY_MIN_CONFIDENCE
  const modelAskedForReview = triage.suggested_action === SUGGESTED_ACTION.needsReview
  if (belowConfidence || modelAskedForReview) {
    return {
      mailerAction: ACTIVITY_ACTION.needsReview,
      category: triage.category,
      modelConfidence: triage.confidence,
    }
  }
  return {
    mailerAction: ACTIVITY_ACTION.labeled,
    category: triage.category,
    modelConfidence: triage.confidence,
  }
}
