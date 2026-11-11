export const CATEGORY = {
  spam: 'spam',
  highPriority: 'high_priority',
  actionRequired: 'action_required',
  inquiry: 'inquiry',
} as const

export type Category = (typeof CATEGORY)[keyof typeof CATEGORY]
