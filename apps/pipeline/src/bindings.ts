import type { MailboxEvent } from 'mailer-domain'

import type { MailTriageParams } from './triage-mail/mail-triage.ts'

export type TokenCachePutOptions = {
  expirationTtl: number
}

export type TokenCache = {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options: TokenCachePutOptions): Promise<void>
  delete(key: string): Promise<void>
}

export type AccountQueue = {
  send(body: MailboxEvent): Promise<void>
}

export type StartMailTriageInput = {
  id: string
  params: MailTriageParams
}

export type WorkflowStarter = {
  create(input: StartMailTriageInput): Promise<unknown>
}
