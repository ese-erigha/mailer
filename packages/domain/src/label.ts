export const LABEL = {
  spam: 'Mailer/Spam',
  highPriority: 'Mailer/High-Priority',
  actionRequired: 'Mailer/Action-Required',
  inquiry: 'Mailer/Inquiry',
  needsReview: 'Mailer/Needs-Review',
  drafted: 'Mailer/Drafted',
} as const

export type Label = (typeof LABEL)[keyof typeof LABEL]
