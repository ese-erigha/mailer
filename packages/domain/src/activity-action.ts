export const ACTIVITY_ACTION = {
  labeled: 'labeled',
  needsReview: 'needs_review',
  drafted: 'drafted',
  archived: 'archived',
} as const

export type ActivityAction = (typeof ACTIVITY_ACTION)[keyof typeof ACTIVITY_ACTION]
