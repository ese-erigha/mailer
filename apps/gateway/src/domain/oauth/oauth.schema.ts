import { z } from 'zod'

export const oauthCallbackQuerySchema = z.object({
  state: z.string().optional(),
  code: z.string().optional(),
  error: z.string().optional(),
})
