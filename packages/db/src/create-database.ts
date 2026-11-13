import { drizzle } from 'drizzle-orm/d1'

import * as schema from './schema/index.ts'

export function createDatabase(client: Parameters<typeof drizzle>[0]) {
  return drizzle(client, { schema })
}

export type MailerDatabase = ReturnType<typeof createDatabase>
