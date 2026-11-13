import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ERROR_CODE } from 'mailer-domain'

import app from './app.ts'

const gatewayEnv = {
  APP_ORIGIN: 'https://mailer.example',
  GOOGLE_CLIENT_ID: 'client',
  GOOGLE_CLIENT_SECRET: 'secret',
  GCP_PROJECT_ID: 'project',
  PUBSUB_TOPIC: 'topic',
  PUBSUB_AUDIENCE: 'https://mailer.example/v1/gmail/push',
  PUBSUB_SERVICE_ACCOUNT: 'push@mailer.example',
  GOOGLE_APP_TESTING: 'true',
  TOKEN_ENCRYPTION_KEY: 'key',
  DB: {},
}

describe('gateway', () => {
  it('when a client calls health, then the gateway returns ok', async () => {
    const response = await app.request('/health')
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ok: true })
  })

  it('when the path is missing, then the gateway returns not found', async () => {
    const response = await app.request('/v1/missing', {}, gatewayEnv)
    assert.equal(response.status, 404)
    assert.deepEqual(await response.json(), {
      error: { code: ERROR_CODE.notFound, message: 'The resource was not found.' },
    })
  })

  it('when the push token is missing, then the gateway returns unauthorized', async () => {
    const response = await app.request('/v1/gmail/push', { method: 'POST', body: '{}' }, gatewayEnv)
    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      error: { code: ERROR_CODE.unauthorized, message: 'The push token is invalid.' },
    })
  })
})
