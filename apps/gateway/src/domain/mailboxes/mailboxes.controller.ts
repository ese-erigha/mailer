import type { Context } from 'hono'
import { Hono } from 'hono'

import { COOKIE, clearCookie, readCookie } from '../../cookies.ts'
import { disconnectMailbox, type DisconnectMailboxInput } from './usecases/disconnect-mailbox.usecase.ts'
import { readMailbox } from './usecases/read-mailbox.usecase.ts'
import { requireSession } from './usecases/require-session.usecase.ts'

const mailboxes = new Hono()

mailboxes.get('/me', readMailboxRoute)
mailboxes.delete('/me', disconnectMailboxRoute)

export default mailboxes

async function readMailboxRoute(c: Context): Promise<Response> {
  const session = await requireSession(readCookie(c, COOKIE.session))
  const mailbox = await readMailbox(session.accountId)
  return c.json(mailbox)
}

async function disconnectMailboxRoute(c: Context): Promise<Response> {
  const input: DisconnectMailboxInput = {
    token: readCookie(c, COOKIE.session),
    origin: c.req.header('origin'),
  }
  await disconnectMailbox(input)
  clearCookie(c, COOKIE.session)
  return c.body(null, 204)
}
