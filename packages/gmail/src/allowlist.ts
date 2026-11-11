export const GMAIL_METHOD = {
  watch: 'users.watch',
  stop: 'users.stop',
  profileGet: 'users.getProfile',
  historyList: 'users.history.list',
  messageGet: 'users.messages.get',
  labelCreate: 'users.labels.create',
  labelList: 'users.labels.list',
  threadModify: 'users.threads.modify',
  draftCreate: 'users.drafts.create',
} as const

export type GmailMethod = (typeof GMAIL_METHOD)[keyof typeof GMAIL_METHOD]
