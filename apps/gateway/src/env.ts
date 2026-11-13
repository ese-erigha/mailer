import { z } from 'zod'

const gatewayEnvSchema = z.object({
  APP_ORIGIN: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GCP_PROJECT_ID: z.string().min(1),
  PUBSUB_TOPIC: z.string().min(1),
  PUBSUB_AUDIENCE: z.string().url(),
  PUBSUB_SERVICE_ACCOUNT: z.string().email(),
  GOOGLE_APP_TESTING: z.enum(['true', 'false']),
  TOKEN_ENCRYPTION_KEY: z.string().min(1),
})

export type GatewayEnv = z.infer<typeof gatewayEnvSchema>

export function readGatewayEnv(source: Record<string, unknown>): GatewayEnv {
  const env = {
    APP_ORIGIN: source.APP_ORIGIN,
    GOOGLE_CLIENT_ID: source.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: source.GOOGLE_CLIENT_SECRET,
    GCP_PROJECT_ID: source.GCP_PROJECT_ID,
    PUBSUB_TOPIC: source.PUBSUB_TOPIC,
    PUBSUB_AUDIENCE: source.PUBSUB_AUDIENCE,
    PUBSUB_SERVICE_ACCOUNT: source.PUBSUB_SERVICE_ACCOUNT,
    GOOGLE_APP_TESTING: source.GOOGLE_APP_TESTING,
    TOKEN_ENCRYPTION_KEY: source.TOKEN_ENCRYPTION_KEY,
  }
  return gatewayEnvSchema.parse(env)
}
