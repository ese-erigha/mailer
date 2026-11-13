import { createRemoteJWKSet, jwtVerify } from 'jose'

import { getConfig } from '../../context.ts'

const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))

export async function verifyPushToken(token: string): Promise<boolean> {
  const config = getConfig()
  try {
    const verified = await jwtVerify(token, googleKeys, {
      audience: config.PUBSUB_AUDIENCE,
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
    })
    return verified.payload.email === config.PUBSUB_SERVICE_ACCOUNT && verified.payload.email_verified === true
  } catch {
    return false
  }
}
