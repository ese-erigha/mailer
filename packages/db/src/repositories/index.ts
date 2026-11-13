import type { MailerDatabase } from '../create-database.ts'
import { AccountRepository } from './accounts.repository.ts'
import { ActivityRepository } from './activities.repository.ts'
import { MailboxRepository } from './mailboxes.repository.ts'
import { OauthTokenRepository } from './oauth-tokens.repository.ts'
import { SessionRepository } from './sessions.repository.ts'

export class MailerRepositories {
  readonly accounts: AccountRepository
  readonly sessions: SessionRepository
  readonly oauthTokens: OauthTokenRepository
  readonly mailboxes: MailboxRepository
  readonly activities: ActivityRepository

  constructor(database: MailerDatabase) {
    this.accounts = new AccountRepository(database)
    this.sessions = new SessionRepository(database)
    this.oauthTokens = new OauthTokenRepository(database)
    this.mailboxes = new MailboxRepository(database)
    this.activities = new ActivityRepository(database)
  }
}
