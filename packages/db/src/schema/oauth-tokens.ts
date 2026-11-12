import { blob, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { accounts } from './accounts.ts'

export const oauthTokens = sqliteTable('oauth_tokens', {
  accountId: text('account_id')
    .primaryKey()
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  encryptedRefreshToken: blob('encrypted_refresh_token').notNull(),
  encryptionNonce: blob('encryption_nonce').notNull(),
  consentedAt: integer('consented_at').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export type OauthTokenRecord = typeof oauthTokens.$inferSelect
export type NewOauthTokenRecord = typeof oauthTokens.$inferInsert
