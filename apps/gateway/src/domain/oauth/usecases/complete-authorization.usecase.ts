import { exchangeAuthorizationCode, watchInbox, type ExchangeAuthorizationCodeInput, type GmailWatch, type GoogleTokenSet } from 'gmail'
import {
  GOOGLE_SCOPE,
  GOOGLE_TESTING_TOKEN_DAYS,
  MAILBOX_STATUS,
  OAUTH_ERROR_REASON,
  type OauthErrorReason,
  SESSION_MAX_AGE_SECONDS,
} from 'mailer-domain'
import { encryptRefreshToken, type EncryptRefreshTokenInput } from 'tokens'
import type { InsertSessionInput, SaveGoogleAccountInput, SaveMailboxInput, SaveOauthTokenInput } from 'db'

import { getConfig, getRepositories } from '../../../context.ts'
import { randomUrlToken, sha256Hex } from '../../../session-token.ts'
import { ensurePhase1Labels } from '../ensure-phase1-labels.ts'
import { readIdToken, type GoogleIdentity } from '../read-id-token.ts'

const DAY_MS = 24 * 60 * 60 * 1000

export type FinishedAuthorization = {
  location: string
  sessionToken: string | null
}

export type CompleteAuthorizationInput = {
  state: string | undefined
  cookieState: string | undefined
  code: string | undefined
  googleError: string | undefined
}

type AuthorizationStep<T> = { ok: true; value: T } | { ok: false; result: FinishedAuthorization }

type AcceptedGrant = {
  accessToken: string
  refreshToken: string
  identity: GoogleIdentity
}

type PreparedMailbox = {
  labelIds: Record<string, string>
  watch: GmailWatch
}

type ConnectedMailbox = {
  grant: AcceptedGrant
  mailbox: PreparedMailbox
}

export async function completeAuthorization(input: CompleteAuthorizationInput): Promise<FinishedAuthorization> {
  const callback = readCallback(input)
  if (!callback.ok) return callback.result
  const grant = await exchangeCode(callback.value)
  if (!grant.ok) return grant.result
  const mailbox = await prepareMailbox(grant.value)
  if (!mailbox.ok) return mailbox.result
  const connected: ConnectedMailbox = { grant: grant.value, mailbox: mailbox.value }
  return saveConnection(connected)
}

function readCallback(input: CompleteAuthorizationInput): AuthorizationStep<string> {
  if (!input.state || input.state !== input.cookieState) return rejected(OAUTH_ERROR_REASON.state)
  if (input.googleError === 'access_denied') return rejected(OAUTH_ERROR_REASON.denied)
  if (!input.code) return rejected(OAUTH_ERROR_REASON.exchange)
  return accepted(input.code)
}

async function exchangeCode(code: string): Promise<AuthorizationStep<AcceptedGrant>> {
  const config = getConfig()
  try {
    const request: ExchangeAuthorizationCodeInput = {
      clientId: config.GOOGLE_CLIENT_ID,
      clientSecret: config.GOOGLE_CLIENT_SECRET,
      code,
      redirectUri: `${config.APP_ORIGIN}/v1/oauth/callback`,
    }
    const tokens = await exchangeAuthorizationCode(request)
    return acceptGrant(tokens)
  } catch {
    return rejected(OAUTH_ERROR_REASON.exchange)
  }
}

function acceptGrant(tokens: GoogleTokenSet): AuthorizationStep<AcceptedGrant> {
  if (!tokens.refreshToken || !tokens.idToken) return rejected(OAUTH_ERROR_REASON.exchange)
  if (!tokens.scope.includes(GOOGLE_SCOPE.gmailModify)) return rejected(OAUTH_ERROR_REASON.scope)
  const identity = readIdToken(tokens.idToken)
  if (!identity.emailVerified) return rejected(OAUTH_ERROR_REASON.exchange)
  const grant: AcceptedGrant = { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, identity }
  return accepted(grant)
}

async function prepareMailbox(grant: AcceptedGrant): Promise<AuthorizationStep<PreparedMailbox>> {
  const config = getConfig()
  let labelIds
  try {
    labelIds = await ensurePhase1Labels(grant.accessToken)
  } catch {
    return rejected(OAUTH_ERROR_REASON.exchange)
  }
  try {
    const watch = await watchInbox(
      grant.accessToken,
      `projects/${config.GCP_PROJECT_ID}/topics/${config.PUBSUB_TOPIC}`,
    )
    const prepared: PreparedMailbox = { labelIds, watch }
    return accepted(prepared)
  } catch {
    return rejected(OAUTH_ERROR_REASON.watch)
  }
}

async function saveConnection(input: ConnectedMailbox): Promise<FinishedAuthorization> {
  const now = Date.now()
  const accountId = await saveAccount(input.grant, now)
  await saveRefreshToken(accountId, input.grant.refreshToken, now)
  await saveMailbox(accountId, input.mailbox, now)
  const sessionToken = await openSession(accountId, now)
  return { location: `${getConfig().APP_ORIGIN}/connected`, sessionToken }
}

async function saveAccount(grant: AcceptedGrant, now: number): Promise<string> {
  const account: SaveGoogleAccountInput = {
    id: crypto.randomUUID(),
    googleSubClaim: grant.identity.sub,
    gmailAddress: grant.identity.email,
    now,
  }
  return getRepositories().accounts.saveGoogleAccount(account)
}

async function saveRefreshToken(accountId: string, refreshToken: string, now: number): Promise<void> {
  const request: EncryptRefreshTokenInput = {
    keyBase64: getConfig().TOKEN_ENCRYPTION_KEY,
    accountId,
    refreshToken,
  }
  const encrypted = await encryptRefreshToken(request)
  const token: SaveOauthTokenInput = {
    accountId,
    encryptedRefreshToken: encrypted.encryptedRefreshToken,
    encryptionNonce: encrypted.encryptionNonce,
    consentedAt: now,
    createdAt: now,
    updatedAt: now,
  }
  await getRepositories().oauthTokens.save(token)
}

async function saveMailbox(accountId: string, mailbox: PreparedMailbox, now: number): Promise<void> {
  const record: SaveMailboxInput = {
    accountId,
    gmailHistoryId: mailbox.watch.historyId,
    gmailWatchExpiresAt: Number(mailbox.watch.expiration),
    labelIdByName: JSON.stringify(mailbox.labelIds),
    status: MAILBOX_STATUS.connected,
    now,
  }
  await getRepositories().mailboxes.save(record)
}

async function openSession(accountId: string, now: number): Promise<string> {
  const sessionToken = randomUrlToken()
  const tokenHash = await sha256Hex(sessionToken)
  const session: InsertSessionInput = {
    tokenHash,
    accountId,
    expiresAt: now + SESSION_MAX_AGE_SECONDS * 1000,
    createdAt: now,
  }
  await getRepositories().sessions.insert(session)
  return sessionToken
}

function accepted<T>(value: T): AuthorizationStep<T> {
  return { ok: true, value }
}

function rejected(reason: OauthErrorReason): AuthorizationStep<never> {
  return { ok: false, result: failed(reason) }
}

function failed(reason: OauthErrorReason): FinishedAuthorization {
  return { location: `${getConfig().APP_ORIGIN}/error?reason=${reason}`, sessionToken: null }
}

export function accessEndsAt(consentedAt: number, testing: boolean): number | null {
  if (!testing) return null
  return consentedAt + GOOGLE_TESTING_TOKEN_DAYS * DAY_MS
}
