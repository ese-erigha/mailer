import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey().notNull(),
  googleSubClaim: text('google_sub_claim').notNull().unique(),
  gmailAddress: text('gmail_address').notNull().unique(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export type AccountRecord = typeof accounts.$inferSelect
export type NewAccountRecord = typeof accounts.$inferInsert
