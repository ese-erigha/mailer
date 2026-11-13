import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ERROR_CODE } from 'mailer-domain'

import { gmailPushEnvelopeSchema } from './domain/gmail-push/gmail-push.schema.ts'
import { handleErrors, parseRequest, RequestError } from './http-error.ts'

describe('handleErrors', () => {
  it('when the session is missing, then the response is unauthorized', async () => {
    const error = new RequestError(401, ERROR_CODE.unauthorized, 'Sign in is required.')
    const response = handleErrors(jsonContext(), error)
    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), { error: { code: ERROR_CODE.unauthorized, message: 'Sign in is required.' } })
  })
})

describe('parseRequest', () => {
  it('when the push body is not an object, then parseRequest throws a validation error', () => {
    assert.throws(() => parseRequest(gmailPushEnvelopeSchema, []), RequestError)
  })
})

function jsonContext() {
  return {
    json(body: unknown, status: number) {
      return Response.json(body, { status })
    },
  } as Parameters<typeof handleErrors>[0]
}
