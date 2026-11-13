import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers'
import type { NewActivityRecord } from 'db'
import { GMAIL_ERROR, GmailRequestError, readMessage } from 'gmail'
import { log } from 'log'
import { ACTIVITY_ACTION, MAILBOX_STATUS, type MailerDecision } from 'mailer-domain'

import { readAccessToken } from '../access-token.ts'
import { getRepositories, pipelineContext, pipelineStorage } from '../context.ts'
import { classifyMessage, type ClassificationResult } from './classify-message.ts'
import { labelThread, type LabelThreadInput } from './label-thread.ts'
import { readMessageText } from './read-message-text.ts'

export type MailTriageParams = { accountId: string; messageId: string; threadId: string }

export class MailTriage extends WorkflowEntrypoint<Record<string, unknown>, MailTriageParams> {
  async run(event: WorkflowEvent<MailTriageParams>, step: WorkflowStep): Promise<void> {
    const context = pipelineContext(this.env)
    const startedAt = Date.now()
    const params = event.payload
    const loaded = await step.do('load the account', async () =>
      pipelineStorage.run(context, () => loadAccount(params.accountId)),
    )
    if (!loaded) return
    const duplicate = await step.do('skip a duplicate', async () =>
      pipelineStorage.run(context, () => alreadyLabeled(params.accountId, params.messageId)),
    )
    if (duplicate) return
    const message = await step.do('fetch the message', async () => pipelineStorage.run(context, () => fetchMessage(params)))
    if (!message) return
    let classified
    try {
      classified = await step.do('classify', async () => pipelineStorage.run(context, () => classifyMessage(message)))
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Error'
      log.error('classify_failed', params.accountId, params.messageId, detail)
      classified = failedClassification()
    }
    await step.do('label the thread', async () =>
      pipelineStorage.run(context, () => labelLoadedThread(params, classified.decision)),
    )
    await step.do('write the activity', async () =>
      pipelineStorage.run(context, () => writeActivity(params, message.subject, classified, startedAt)),
    )
  }
}

async function loadAccount(accountId: string) {
  const repositories = getRepositories()
  const account = await repositories.accounts.findById(accountId)
  const mailbox = await repositories.mailboxes.findByAccountId(accountId)
  if (!account || !mailbox || mailbox.status !== MAILBOX_STATUS.connected) return null
  return { labelIdByName: mailbox.labelIdByName }
}

async function alreadyLabeled(accountId: string, messageId: string): Promise<boolean> {
  const existing = await getRepositories().activities.findByMessage(accountId, messageId)
  return Boolean(existing)
}

async function fetchMessage(params: MailTriageParams) {
  const accessToken = await readAccessToken(params.accountId)
  if (!accessToken) return null
  try {
    const message = await readMessage(accessToken, params.messageId)
    return readMessageText(message)
  } catch (error) {
    if (error instanceof GmailRequestError && error.kind === GMAIL_ERROR.notFound) return null
    throw error
  }
}

function failedClassification(): ClassificationResult {
  return {
    decision: { mailerAction: ACTIVITY_ACTION.needsReview, category: null, modelConfidence: null },
    modelId: null,
    promptTokens: null,
    completionTokens: null,
  }
}

async function labelLoadedThread(params: MailTriageParams, decision: MailerDecision) {
  const repositories = getRepositories()
  const mailbox = await repositories.mailboxes.findByAccountId(params.accountId)
  const accessToken = await readAccessToken(params.accountId)
  if (!mailbox || !accessToken) return
  const thread: LabelThreadInput = {
    accessToken,
    accountId: params.accountId,
    threadId: params.threadId,
    decision,
    labelIdByName: mailbox.labelIdByName,
    repositories,
  }
  await labelThread(thread)
}

async function writeActivity(
  params: MailTriageParams,
  subject: string,
  classified: ClassificationResult,
  startedAt: number,
) {
  const createdAt = Date.now()
  const activity: NewActivityRecord = {
    accountId: params.accountId,
    gmailMessageId: params.messageId,
    gmailThreadId: params.threadId,
    emailSubject: subject,
    category: classified.decision.category,
    modelConfidence: classified.decision.modelConfidence,
    mailerAction: classified.decision.mailerAction,
    modelId: classified.modelId,
    promptTokens: classified.promptTokens,
    completionTokens: classified.completionTokens,
    triageDurationMs: createdAt - startedAt,
    createdAt,
  }
  await getRepositories().activities.insertIgnore(activity)
}
