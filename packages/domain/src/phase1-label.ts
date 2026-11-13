import { ACTIVITY_ACTION, type ActivityAction } from './activity-action.ts'
import { CATEGORY, type Category } from './category.ts'
import { LABEL, type Label } from './label.ts'

export const PHASE_1_LABEL = [
  LABEL.spam,
  LABEL.highPriority,
  LABEL.actionRequired,
  LABEL.inquiry,
  LABEL.needsReview,
] as const

const LABEL_BY_CATEGORY: Record<Category, Label> = {
  [CATEGORY.spam]: LABEL.spam,
  [CATEGORY.highPriority]: LABEL.highPriority,
  [CATEGORY.actionRequired]: LABEL.actionRequired,
  [CATEGORY.inquiry]: LABEL.inquiry,
}

export function labelForDecision(mailerAction: ActivityAction, category: Category | null): Label {
  if (mailerAction === ACTIVITY_ACTION.labeled && category) {
    return LABEL_BY_CATEGORY[category]
  }
  return LABEL.needsReview
}
