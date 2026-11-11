import { z } from 'zod'

const mailboxEventSchema = z.object({
  accountId: z.string().min(1),
})

export type MailboxEvent = z.infer<typeof mailboxEventSchema>

export function parseMailboxEvent(input: unknown): MailboxEvent {
  return mailboxEventSchema.parse(input)
}
