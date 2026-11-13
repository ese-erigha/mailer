import { eq } from 'drizzle-orm'

import type { MailerDatabase } from '../create-database.ts'
import { oauthTokens, type OauthTokenRecord } from '../schema/oauth-tokens.ts'

export type SaveOauthTokenInput = {
  accountId: string
  encryptedRefreshToken: Uint8Array
  encryptionNonce: Uint8Array
  consentedAt: number
  createdAt: number
  updatedAt: number
}

export class OauthTokenRepository {
  private readonly database: MailerDatabase

  constructor(database: MailerDatabase) {
    this.database = database
  }

  async findByAccountId(accountId: string): Promise<OauthTokenRecord | undefined> {
    const rows = await this.database.select().from(oauthTokens).where(eq(oauthTokens.accountId, accountId)).limit(1)
    return rows[0]
  }

  async save(input: SaveOauthTokenInput): Promise<void> {
    const changes = {
      encryptedRefreshToken: input.encryptedRefreshToken,
      encryptionNonce: input.encryptionNonce,
      consentedAt: input.consentedAt,
      updatedAt: input.updatedAt,
    }
    const conflict = { target: oauthTokens.accountId, set: changes }
    await this.database.insert(oauthTokens).values(input).onConflictDoUpdate(conflict)
  }

  async deleteByAccountId(accountId: string): Promise<void> {
    await this.database.delete(oauthTokens).where(eq(oauthTokens.accountId, accountId))
  }
}
