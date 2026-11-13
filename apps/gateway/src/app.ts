import { Hono, type Context } from 'hono'
import { ERROR_CODE } from 'mailer-domain'

import { gatewayContext, gatewayStorage } from './context.ts'
import gmailPush from './domain/gmail-push/gmail-push.controller.ts'
import mailboxes from './domain/mailboxes/mailboxes.controller.ts'
import oauth from './domain/oauth/oauth.controller.ts'
import { handleErrors, RequestError } from './http-error.ts'

const app = new Hono()

app.use('/v1/*', async (c, next) => {
  await gatewayStorage.run(gatewayContext(c.env as Record<string, unknown>), next)
})

app.onError((error, c) => handleErrors(c, error))
app.get('/health', readHealth)
app.route('/v1/oauth', oauth)
app.route('/v1/mailboxes', mailboxes)
app.route('/v1/gmail/push', gmailPush)
app.all('/v1/*', missingRoute)

function readHealth(c: Context): Response {
  const body = { ok: true }
  return c.json(body)
}

function missingRoute(): never {
  throw new RequestError(404, ERROR_CODE.notFound, 'The resource was not found.')
}

export default app
