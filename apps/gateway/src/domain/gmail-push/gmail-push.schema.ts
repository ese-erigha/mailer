import { z } from 'zod'

export const gmailPushEnvelopeSchema = z.object({
  message: z
    .object({
      data: z.string().optional(),
    })
    .optional(),
})
