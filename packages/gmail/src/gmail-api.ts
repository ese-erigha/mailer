import { GmailRequestError, gmailErrorKind } from './gmail-error.ts'

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me'

export type GmailLabel = { id: string; name: string }
export type GmailAddedMessage = { id: string; threadId: string; labelIds: string[]; historyId: string }
export type GmailProfile = { historyId: string }
export type GmailWatch = { historyId: string; expiration: string }
export type GmailMessage = {
  id: string
  threadId: string
  payload: GmailPayload
}
export type GmailPayload = {
  mimeType?: string
  filename?: string
  headers?: Array<{ name: string; value: string }>
  body?: { data?: string }
  parts?: GmailPayload[]
}

export async function listLabels(accessToken: string): Promise<GmailLabel[]> {
  const payload = (await gmailJson(accessToken, '/labels', 'GET')) as { labels?: GmailLabel[] }
  return payload.labels ?? []
}

export async function createLabel(accessToken: string, name: string): Promise<GmailLabel> {
  return (await gmailJson(accessToken, '/labels', 'POST', {
    name,
    labelListVisibility: 'labelShow',
    messageListVisibility: 'show',
  })) as GmailLabel
}

export async function watchInbox(accessToken: string, topicName: string): Promise<GmailWatch> {
  return (await gmailJson(accessToken, '/watch', 'POST', {
    topicName,
    labelIds: ['INBOX'],
    labelFilterBehavior: 'INCLUDE',
  })) as GmailWatch
}

export async function stopWatch(accessToken: string): Promise<void> {
  await gmailJson(accessToken, '/stop', 'POST')
}

export async function readProfile(accessToken: string): Promise<GmailProfile> {
  return (await gmailJson(accessToken, '/profile', 'GET')) as GmailProfile
}

export async function readMessage(accessToken: string, messageId: string): Promise<GmailMessage> {
  return (await gmailJson(accessToken, `/messages/${messageId}?format=full`, 'GET')) as GmailMessage
}

export type ModifyThreadInput = {
  accessToken: string
  threadId: string
  addLabelIds: string[]
  removeLabelIds: string[]
}

export type ListAddedInboxMessagesInput = {
  accessToken: string
  startHistoryId: string
  maxMessages: number
}

export type AddedInboxPage = {
  messages: GmailAddedMessage[]
  historyId: string
  capped: boolean
}

export async function modifyThread(input: ModifyThreadInput): Promise<void> {
  const labels: ThreadLabelChange = {
    addLabelIds: input.addLabelIds,
    removeLabelIds: input.removeLabelIds,
  }
  await gmailJson(input.accessToken, `/threads/${input.threadId}/modify`, 'POST', labels)
}

export async function listAddedInboxMessages(input: ListAddedInboxMessagesInput): Promise<AddedInboxPage> {
  const messages: GmailAddedMessage[] = []
  const seen = new Set<string>()
  let pageToken = ''
  let historyId = input.startHistoryId
  while (messages.length < input.maxMessages) {
    const page = await listHistoryPage(input.accessToken, input.startHistoryId, pageToken)
    historyId = page.historyId || historyId
    for (const record of page.records) {
      for (const added of record.messagesAdded ?? []) {
        const message = added.message
        if (!message?.id || !message.threadId || seen.has(message.id)) continue
        const labelIds = message.labelIds ?? []
        if (labelIds.includes('SENT') || labelIds.includes('DRAFT')) continue
        seen.add(message.id)
        const inboxMessage: GmailAddedMessage = {
          id: message.id,
          threadId: message.threadId,
          labelIds,
          historyId: record.id,
        }
        messages.push(inboxMessage)
        if (messages.length >= input.maxMessages) {
          return { messages, historyId: record.id, capped: true }
        }
      }
    }
    if (!page.nextPageToken) break
    pageToken = page.nextPageToken
  }
  return { messages, historyId, capped: false }
}

type HistoryMessageRef = {
  id?: string
  threadId?: string
  labelIds?: string[]
}

type HistoryAdded = {
  message?: HistoryMessageRef
}

type HistoryRecord = {
  id: string
  messagesAdded?: HistoryAdded[]
}

type HistoryPage = {
  historyId: string
  nextPageToken: string
  records: HistoryRecord[]
}

type HistoryResponse = {
  historyId?: string
  nextPageToken?: string
  history?: HistoryRecord[]
}

type ThreadLabelChange = {
  addLabelIds: string[]
  removeLabelIds: string[]
}

async function listHistoryPage(accessToken: string, startHistoryId: string, pageToken: string): Promise<HistoryPage> {
  const fields = {
    startHistoryId,
    historyTypes: 'messageAdded',
    labelId: 'INBOX',
    maxResults: '500',
  }
  const query = new URLSearchParams(fields)
  if (pageToken) query.set('pageToken', pageToken)
  const payload = (await gmailJson(accessToken, `/history?${query.toString()}`, 'GET')) as HistoryResponse
  return {
    historyId: payload.historyId ?? '',
    nextPageToken: payload.nextPageToken ?? '',
    records: payload.history ?? [],
  }
}

async function gmailJson(accessToken: string, path: string, method: string, body?: unknown): Promise<unknown> {
  const headers = {
    authorization: `Bearer ${accessToken}`,
    'content-type': 'application/json',
  }
  const request = {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }
  const response = await fetch(`${GMAIL_API}${path}`, request)
  if (!response.ok) {
    throw new GmailRequestError(gmailErrorKind(response.status), response.status)
  }
  if (response.status === 204) return {}
  return response.json()
}
