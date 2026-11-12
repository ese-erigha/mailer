import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { accounts } from './accounts.ts'

export const sessions = sqliteTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey().notNull(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('idx_sessions_account_id').on(table.accountId)],
)

export type SessionRecord = typeof sessions.$inferSelect
export type NewSessionRecord = typeof sessions.$inferInsert
