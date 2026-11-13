export { createDatabase } from './create-database.ts'
export type { MailerDatabase } from './create-database.ts'
export { DIALECT } from './database.ts'
export { MailerRepositories } from './repositories/index.ts'
export { AccountRepository } from './repositories/accounts.repository.ts'
export type { SaveGoogleAccountInput } from './repositories/accounts.repository.ts'
export { ActivityRepository } from './repositories/activities.repository.ts'
export { MailboxRepository } from './repositories/mailboxes.repository.ts'
export type { SaveMailboxInput } from './repositories/mailboxes.repository.ts'
export { OauthTokenRepository } from './repositories/oauth-tokens.repository.ts'
export type { SaveOauthTokenInput } from './repositories/oauth-tokens.repository.ts'
export { SessionRepository } from './repositories/sessions.repository.ts'
export type { InsertSessionInput } from './repositories/sessions.repository.ts'
export {
  accounts,
  activities,
  mailboxes,
  oauthTokens,
  sessions,
  type AccountRecord,
  type ActivityRecord,
  type MailboxRecord,
  type NewAccountRecord,
  type NewActivityRecord,
  type NewMailboxRecord,
  type NewOauthTokenRecord,
  type NewSessionRecord,
  type OauthTokenRecord,
  type SessionRecord,
} from './schema/index.ts'
