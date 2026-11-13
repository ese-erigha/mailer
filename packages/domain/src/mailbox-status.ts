export const MAILBOX_STATUS = {
  connected: 'connected',
  disconnected: 'disconnected',
} as const

export type MailboxStatus = (typeof MAILBOX_STATUS)[keyof typeof MAILBOX_STATUS]
