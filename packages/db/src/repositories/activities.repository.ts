import { and, desc, eq } from 'drizzle-orm'

import type { MailerDatabase } from '../create-database.ts'
import { activities, type ActivityRecord, type NewActivityRecord } from '../schema/activities.ts'

export class ActivityRepository {
  private readonly database: MailerDatabase

  constructor(database: MailerDatabase) {
    this.database = database
  }

  async findByMessage(accountId: string, gmailMessageId: string): Promise<ActivityRecord | undefined> {
    const rows = await this.database
      .select()
      .from(activities)
      .where(and(eq(activities.accountId, accountId), eq(activities.gmailMessageId, gmailMessageId)))
      .limit(1)
    return rows[0]
  }

  async findLatest(accountId: string): Promise<ActivityRecord | undefined> {
    const rows = await this.database
      .select()
      .from(activities)
      .where(eq(activities.accountId, accountId))
      .orderBy(desc(activities.createdAt))
      .limit(1)
    return rows[0]
  }

  async insertIgnore(input: NewActivityRecord): Promise<void> {
    await this.database.insert(activities).values(input).onConflictDoNothing()
  }
}
