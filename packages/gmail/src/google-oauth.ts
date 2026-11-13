import { GMAIL_ERROR, GmailRequestError } from './gmail-error.ts'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'

export type ExchangeAuthorizationCodeInput = {
  clientId: string
  clientSecret: string
  code: string
  redirectUri: string
}

export type RefreshAccessTokenInput = {
  clientId: string
  clientSecret: string
  refreshToken: string
}

export type AccessToken = {
  accessToken: string
  expiresIn: number
}

export type AuthorizationUrlInput = {
  clientId: string
  redirectUri: string
  scope: string
  state: string
}

export type GoogleTokenSet = {
  accessToken: string
  refreshToken: string | null
  expiresIn: number
  scope: string
  idToken: string | null
}

export async function exchangeAuthorizationCode(input: ExchangeAuthorizationCodeInput): Promise<GoogleTokenSet> {
  const fields = {
    code: input.code,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: 'authorization_code',
  }
  const body = new URLSearchParams(fields)
  return readTokenResponse(await postForm(TOKEN_URL, body))
}

export async function refreshAccessToken(input: RefreshAccessTokenInput): Promise<AccessToken> {
  const fields = {
    refresh_token: input.refreshToken,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    grant_type: 'refresh_token',
  }
  const body = new URLSearchParams(fields)
  const tokens = await readTokenResponse(await postForm(TOKEN_URL, body))
  return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn }
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const fields = { token: refreshToken }
  const body = new URLSearchParams(fields)
  const response = await postForm(REVOKE_URL, body)
  if (response.ok) return
  throw new GmailRequestError(GMAIL_ERROR.rejected, response.status)
}

export function authorizationUrl(input: AuthorizationUrlInput): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', input.clientId)
  url.searchParams.set('redirect_uri', input.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', input.scope)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('include_granted_scopes', 'false')
  url.searchParams.set('state', input.state)
  return url.toString()
}

async function postForm(url: string, body: URLSearchParams): Promise<Response> {
  const headers = { 'content-type': 'application/x-www-form-urlencoded' }
  const request = { method: 'POST', headers, body }
  return fetch(url, request)
}

async function readTokenResponse(response: Response): Promise<GoogleTokenSet> {
  const payload = (await response.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    scope?: string
    id_token?: string
    error?: string
  }
  if (payload.error === 'invalid_grant') {
    throw new GmailRequestError(GMAIL_ERROR.invalidGrant, response.status)
  }
  if (!response.ok || !payload.access_token || !payload.expires_in) {
    throw new GmailRequestError(GMAIL_ERROR.rejected, response.status)
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    expiresIn: payload.expires_in,
    scope: payload.scope ?? '',
    idToken: payload.id_token ?? null,
  }
}
