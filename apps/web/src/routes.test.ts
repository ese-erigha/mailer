import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ROUTE } from './routes.ts'

describe('ROUTE', () => {
  it('when the home path is read, then it is the site root', () => {
    assert.equal(ROUTE.home, '/')
  })
})
