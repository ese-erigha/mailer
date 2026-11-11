import { z } from 'zod'

import { CATEGORY } from './category.ts'
import { SUGGESTED_ACTION } from './suggested-action.ts'

export const CLASSIFY_MIN_CONFIDENCE = 0.7

const emailTriageSchema = z.object({
  category: z.enum(CATEGORY),
  confidence: z.number().min(0).max(1),
  requires_followup: z.boolean(),
  suggested_action: z.enum(SUGGESTED_ACTION),
  action_items: z.array(z.string()),
  due_on: z.string().nullable(),
})

export type EmailTriage = z.infer<typeof emailTriageSchema>

export function parseEmailTriage(input: unknown): EmailTriage {
  return emailTriageSchema.parse(input)
}
