export const SUGGESTED_ACTION = {
  labelOnly: 'label_only',
  draftReply: 'draft_reply',
  needsReview: 'needs_review',
} as const

export type SuggestedAction = (typeof SUGGESTED_ACTION)[keyof typeof SUGGESTED_ACTION]
