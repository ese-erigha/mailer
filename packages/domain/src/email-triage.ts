import { z } from 'zod'

import { CATEGORY } from './category.ts'
import { SUGGESTED_ACTION } from './suggested-action.ts'

export const CLASSIFY_MIN_CONFIDENCE = 0.7

export const EMAIL_TRIAGE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['category', 'confidence', 'requires_followup', 'suggested_action', 'action_items', 'due_on'],
  properties: {
    category: { type: 'string', enum: ['spam', 'high_priority', 'action_required', 'inquiry'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    requires_followup: { type: 'boolean' },
    suggested_action: { type: 'string', enum: ['label_only', 'draft_reply', 'needs_review'] },
    action_items: { type: 'array', items: { type: 'string' } },
    due_on: { type: ['string', 'null'] },
  },
} as const

export const emailTriageSchema = z.object({
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
