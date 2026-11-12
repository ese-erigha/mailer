import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { accounts } from './accounts.ts'

export const activities = sqliteTable(
  'activities',
  {
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    gmailMessageId: text('gmail_message_id').notNull(),
    gmailThreadId: text('gmail_thread_id').notNull(),
    emailSubject: text('email_subject').notNull(),
    category: text('category'),
    modelConfidence: real('model_confidence'),
    mailerAction: text('mailer_action').notNull(),
    modelId: text('model_id'),
    promptTokens: integer('prompt_tokens'),
    completionTokens: integer('completion_tokens'),
    triageDurationMs: integer('triage_duration_ms').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.accountId, table.gmailMessageId] }),
    index('idx_activities_account_id_created_at').on(table.accountId, table.createdAt),
  ],
)

export type ActivityRecord = typeof activities.$inferSelect
export type NewActivityRecord = typeof activities.$inferInsert
