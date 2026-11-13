import { authorizationUrl, type AuthorizationUrlInput } from 'gmail'
import { GOOGLE_AUTHORIZATION_SCOPES } from 'mailer-domain'

import { getConfig } from '../../../context.ts'
import { randomUrlToken } from '../../../session-token.ts'

export type StartedAuthorization = {
  location: string
  state: string
}

export function beginAuthorization(): StartedAuthorization {
  const config = getConfig()
  const state = randomUrlToken()
  const request: AuthorizationUrlInput = {
    clientId: config.GOOGLE_CLIENT_ID,
    redirectUri: `${config.APP_ORIGIN}/v1/oauth/callback`,
    scope: GOOGLE_AUTHORIZATION_SCOPES.join(' '),
    state,
  }
  const location = authorizationUrl(request)
  return { location, state }
}
