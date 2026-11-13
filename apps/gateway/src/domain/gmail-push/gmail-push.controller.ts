import type { Context } from 'hono'
import { Hono } from 'hono'
import { ERROR_CODE } from 'mailer-domain'

import { parseRequest, RequestError } from '../../http-error.ts'
import { gmailPushEnvelopeSchema } from './gmail-push.schema.ts'
import { acceptGmailPush, type AcceptGmailPushInput } from './usecases/accept-gmail-push.usecase.ts'
import { verifyPushToken } from './verify-push-token.ts'

const push = new Hono()

push.post('/', acceptPushRoute)

export default push

async function acceptPushRoute(c: Context): Promise<Response> {
  const header = c.req.header('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : ''
  const valid = await verifyPushToken(token)
  if (!valid) throw new RequestError(401, ERROR_CODE.unauthorized, 'The push token is invalid.')
  const body = await c.req.json()
  const envelope = parseRequest(gmailPushEnvelopeSchema, body)
  const input: AcceptGmailPushInput = { data: envelope.message?.data ?? '' }
  await acceptGmailPush(input)
  return c.body(null, 204)
}
