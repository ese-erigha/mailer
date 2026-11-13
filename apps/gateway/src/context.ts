import { AsyncLocalStorage } from 'node:async_hooks'

import { createDatabase, MailerRepositories } from 'db'

import type { AccountQueue } from './account-queue.ts'
import { readGatewayEnv, type GatewayEnv } from './env.ts'

type GatewayContext = {
  config: GatewayEnv
  repositories: MailerRepositories
  queue: AccountQueue
}

export const gatewayStorage = new AsyncLocalStorage<GatewayContext>()

export function gatewayContext(source: Record<string, unknown>): GatewayContext {
  return {
    config: readGatewayEnv(source),
    repositories: new MailerRepositories(createDatabase(source.DB as Parameters<typeof createDatabase>[0])),
    queue: source.MAILBOX_EVENTS as AccountQueue,
  }
}

export function getConfig(): GatewayEnv {
  return context().config
}

export function getRepositories(): MailerRepositories {
  return context().repositories
}

export function getAccountQueue(): AccountQueue {
  return context().queue
}

function context(): GatewayContext {
  const current = gatewayStorage.getStore()
  if (!current) throw new Error('Gateway config is not set.')
  return current
}
