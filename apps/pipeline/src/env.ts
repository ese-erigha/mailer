import { z } from 'zod'

const pipelineEnvSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GCP_PROJECT_ID: z.string().min(1),
  PUBSUB_TOPIC: z.string().min(1),
  OPENROUTER_BASE_URL: z.string().url(),
  OPENROUTER_MODEL: z.string().min(1),
  OPENROUTER_API_KEY: z.string().min(1),
  TOKEN_ENCRYPTION_KEY: z.string().min(1),
})

export type PipelineEnv = z.infer<typeof pipelineEnvSchema>

export function readPipelineEnv(source: Record<string, unknown>): PipelineEnv {
  const env = {
    GOOGLE_CLIENT_ID: source.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: source.GOOGLE_CLIENT_SECRET,
    GCP_PROJECT_ID: source.GCP_PROJECT_ID,
    PUBSUB_TOPIC: source.PUBSUB_TOPIC,
    OPENROUTER_BASE_URL: source.OPENROUTER_BASE_URL,
    OPENROUTER_MODEL: source.OPENROUTER_MODEL,
    OPENROUTER_API_KEY: source.OPENROUTER_API_KEY,
    TOKEN_ENCRYPTION_KEY: source.TOKEN_ENCRYPTION_KEY,
  }
  return pipelineEnvSchema.parse(env)
}
