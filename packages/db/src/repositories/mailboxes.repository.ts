import { MAILBOX_STATUS } from 'mailer-domain'
import { eq, sql } from 'drizzle-orm'

import type { MailerDatabase } from '../create-database.ts'
import { mailboxes, type MailboxRecord, type NewMailboxRecord } from '../schema/mailboxes.ts'

export type SaveMailboxInput = {
  accountId: string
  gmailHistoryId: string
  gmailWatchExpiresAt: number
  labelIdByName: string
  status: string
  now: number
}

export class MailboxRepository {
  private readonly database: MailerDatabase

  constructor(database: MailerDatabase) {
    this.database = database
  }

  async findByAccountId(accountId: string): Promise<MailboxRecord | undefined> {
    const rows = await this.database.select().from(mailboxes).where(eq(mailboxes.accountId, accountId)).limit(1)
    return rows[0]
  }

  async listByStatus(status: string): Promise<MailboxRecord[]> {
    return this.database.select().from(mailboxes).where(eq(mailboxes.status, status))
  }

  async save(input: SaveMailboxInput): Promise<void> {
    const row: NewMailboxRecord = {
      accountId: input.accountId,
      gmailHistoryId: input.gmailHistoryId,
      gmailWatchExpiresAt: input.gmailWatchExpiresAt,
      labelIdByName: input.labelIdByName,
      status: input.status,
      createdAt: input.now,
      updatedAt: input.now,
    }
    const changes = {
      gmailHistoryId: input.gmailHistoryId,
      gmailWatchExpiresAt: input.gmailWatchExpiresAt,
      labelIdByName: input.labelIdByName,
      status: input.status,
      updatedAt: input.now,
    }
    const conflict = { target: mailboxes.accountId, set: changes }
    await this.database.insert(mailboxes).values(row).onConflictDoUpdate(conflict)
  }

  async advanceGmailHistoryId(accountId: string, gmailHistoryId: string, updatedAt: number): Promise<void> {
    await this.database.run(sql`
      UPDATE mailboxes
      SET gmail_history_id = ${gmailHistoryId}, updated_at = ${updatedAt}
      WHERE account_id = ${accountId}
        AND CAST(gmail_history_id AS INTEGER) < CAST(${gmailHistoryId} AS INTEGER)
    `)
  }

  async replaceGmailHistoryId(accountId: string, gmailHistoryId: string, updatedAt: number): Promise<void> {
    const changes = { gmailHistoryId, updatedAt }
    await this.database.update(mailboxes).set(changes).where(eq(mailboxes.accountId, accountId))
  }

  async updateWatchExpiry(accountId: string, gmailWatchExpiresAt: number, updatedAt: number): Promise<void> {
    const changes = { gmailWatchExpiresAt, updatedAt }
    await this.database.update(mailboxes).set(changes).where(eq(mailboxes.accountId, accountId))
  }

  async updateLabelMap(accountId: string, labelIdByName: string, updatedAt: number): Promise<void> {
    const changes = { labelIdByName, updatedAt }
    await this.database.update(mailboxes).set(changes).where(eq(mailboxes.accountId, accountId))
  }

  async markDisconnected(accountId: string, updatedAt: number): Promise<void> {
    const changes = { status: MAILBOX_STATUS.disconnected, updatedAt }
    await this.database.update(mailboxes).set(changes).where(eq(mailboxes.accountId, accountId))
  }
}
