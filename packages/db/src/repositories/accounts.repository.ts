import { eq } from 'drizzle-orm'

import type { MailerDatabase } from '../create-database.ts'
import { accounts, type AccountRecord, type NewAccountRecord } from '../schema/accounts.ts'

export type SaveGoogleAccountInput = {
  id: string
  googleSubClaim: string
  gmailAddress: string
  now: number
}

export class AccountRepository {
  private readonly database: MailerDatabase

  constructor(database: MailerDatabase) {
    this.database = database
  }

  async findById(accountId: string): Promise<AccountRecord | undefined> {
    const rows = await this.database.select().from(accounts).where(eq(accounts.id, accountId)).limit(1)
    return rows[0]
  }

  async findByGmailAddress(gmailAddress: string): Promise<AccountRecord | undefined> {
    const rows = await this.database.select().from(accounts).where(eq(accounts.gmailAddress, gmailAddress)).limit(1)
    return rows[0]
  }

  async saveGoogleAccount(input: SaveGoogleAccountInput): Promise<string> {
    const row: NewAccountRecord = {
      id: input.id,
      googleSubClaim: input.googleSubClaim,
      gmailAddress: input.gmailAddress,
      createdAt: input.now,
      updatedAt: input.now,
    }
    const changes = { gmailAddress: input.gmailAddress, updatedAt: input.now }
    const conflict = { target: accounts.googleSubClaim, set: changes }
    await this.database.insert(accounts).values(row).onConflictDoUpdate(conflict)
    const rows = await this.database
      .select()
      .from(accounts)
      .where(eq(accounts.googleSubClaim, input.googleSubClaim))
      .limit(1)
    const saved = rows[0]
    if (!saved) throw new Error('The Google account was not saved.')
    return saved.id
  }

  async deleteById(accountId: string): Promise<void> {
    await this.database.delete(accounts).where(eq(accounts.id, accountId))
  }
}
