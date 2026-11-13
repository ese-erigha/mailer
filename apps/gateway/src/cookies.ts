import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { OAUTH_STATE_MAX_AGE_SECONDS, SESSION_MAX_AGE_SECONDS } from 'mailer-domain'

export const COOKIE = {
  session: 'mailer_session',
  oauthState: 'mailer_oauth_state',
} as const

const base = { httpOnly: true, secure: true, sameSite: 'Lax' as const, path: '/' }

export function readCookie(c: Context, name: string): string | undefined {
  return getCookie(c, name)
}

export function writeSessionCookie(c: Context, token: string): void {
  const options = { ...base, maxAge: SESSION_MAX_AGE_SECONDS }
  setCookie(c, COOKIE.session, token, options)
}

export function writeStateCookie(c: Context, state: string): void {
  const options = { ...base, maxAge: OAUTH_STATE_MAX_AGE_SECONDS }
  setCookie(c, COOKIE.oauthState, state, options)
}

export function clearCookie(c: Context, name: string): void {
  const options = { path: '/' }
  deleteCookie(c, name, options)
}
