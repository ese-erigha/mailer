import type { Context } from 'hono'
import { Hono } from 'hono'

import { COOKIE, clearCookie, readCookie, writeSessionCookie, writeStateCookie } from '../../cookies.ts'
import { parseRequest } from '../../http-error.ts'
import { beginAuthorization } from './usecases/begin-authorization.usecase.ts'
import { completeAuthorization, type CompleteAuthorizationInput } from './usecases/complete-authorization.usecase.ts'
import { oauthCallbackQuerySchema } from './oauth.schema.ts'

const oauth = new Hono()

oauth.get('/authorization', beginAuthorizationRoute)
oauth.get('/callback', completeAuthorizationRoute)

export default oauth

function beginAuthorizationRoute(c: Context): Response {
  const result = beginAuthorization()
  writeStateCookie(c, result.state)
  return c.redirect(result.location, 302)
}

async function completeAuthorizationRoute(c: Context): Promise<Response> {
  const query = parseRequest(oauthCallbackQuerySchema, c.req.query())
  const input: CompleteAuthorizationInput = {
    state: query.state,
    cookieState: readCookie(c, COOKIE.oauthState),
    code: query.code,
    googleError: query.error,
  }
  const result = await completeAuthorization(input)
  clearCookie(c, COOKIE.oauthState)
  if (result.sessionToken) writeSessionCookie(c, result.sessionToken)
  return c.redirect(result.location, 302)
}
