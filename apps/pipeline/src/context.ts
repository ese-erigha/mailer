import { AsyncLocalStorage } from 'node:async_hooks'

import { createDatabase, MailerRepositories } from 'db'

import type { AccountQueue, TokenCache, WorkflowStarter } from './bindings.ts'
import { readPipelineEnv, type PipelineEnv } from './env.ts'

type PipelineContext = {
  config: PipelineEnv
  repositories: MailerRepositories
  cache: TokenCache
  queue: AccountQueue
  workflows: WorkflowStarter
}

export const pipelineStorage = new AsyncLocalStorage<PipelineContext>()

export function pipelineContext(source: Record<string, unknown>): PipelineContext {
  return {
    config: readPipelineEnv(source),
    repositories: new MailerRepositories(createDatabase(source.DB as Parameters<typeof createDatabase>[0])),
    cache: source.CACHE as TokenCache,
    queue: source.MAILBOX_EVENTS as AccountQueue,
    workflows: source.MAIL_TRIAGE as WorkflowStarter,
  }
}

export function getPipelineConfig(): PipelineEnv {
  return context().config
}

export function getRepositories(): MailerRepositories {
  return context().repositories
}

export function getTokenCache(): TokenCache {
  return context().cache
}

export function getAccountQueue(): AccountQueue {
  return context().queue
}

export function getWorkflows(): WorkflowStarter {
  return context().workflows
}

function context(): PipelineContext {
  const current = pipelineStorage.getStore()
  if (!current) throw new Error('Pipeline config is not set.')
  return current
}
