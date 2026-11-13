export type MailboxView = {
  email: string
  status: string
  watchExpiresAt: string
  lastLabeledAt: string | null
  accessEndsAt: string | null
}

export async function readMailbox(): Promise<MailboxView | null> {
  const response = await fetch('/v1/mailboxes/me')
  if (response.status === 401) return null
  if (!response.ok) throw new Error('The mailbox status could not be read.')
  return response.json() as Promise<MailboxView>
}

export async function disconnectMailbox(): Promise<void> {
  const response = await fetch('/v1/mailboxes/me', { method: 'DELETE' })
  if (!response.ok) throw new Error('The mailbox could not be disconnected.')
}
