import { eq } from 'drizzle-orm'

import type { MailerDatabase } from '../create-database.ts'
import { sessions, type SessionRecord } from '../schema/sessions.ts'

export type InsertSessionInput = {
  tokenHash: string
  accountId: string
  expiresAt: number
  createdAt: number
}

export class SessionRepository {
  private readonly database: MailerDatabase

  constructor(database: MailerDatabase) {
    this.database = database
  }

  async findValid(tokenHash: string, now: number): Promise<SessionRecord | undefined> {
    const rows = await this.database.select().from(sessions).where(eq(sessions.tokenHash, tokenHash)).limit(1)
    const session = rows[0]
    if (!session) return undefined
    if (session.expiresAt > now) return session
    await this.database.delete(sessions).where(eq(sessions.tokenHash, tokenHash))
    return undefined
  }

  async insert(input: InsertSessionInput): Promise<void> {
    await this.database.insert(sessions).values(input)
  }
}
