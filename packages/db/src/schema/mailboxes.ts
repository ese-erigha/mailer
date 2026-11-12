import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { accounts } from './accounts.ts'

export const mailboxes = sqliteTable('mailboxes', {
  accountId: text('account_id')
    .primaryKey()
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  gmailHistoryId: text('gmail_history_id').notNull(),
  gmailWatchExpiresAt: integer('gmail_watch_expires_at').notNull(),
  labelIdByName: text('label_id_by_name').notNull(),
  status: text('status').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export type MailboxRecord = typeof mailboxes.$inferSelect
export type NewMailboxRecord = typeof mailboxes.$inferInsert
