import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const migrationsDir = join(root, 'infra/migrations')
const journalPath = join(migrationsDir, 'meta/_journal.json')

const journalText = () => readFileSync(journalPath, 'utf8')

const journalTags = (text) => new Set(JSON.parse(text).entries.map((entry) => entry.tag))

const sqlFiles = () =>
  readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort()

const migrationName = (fileName) => fileName.slice(0, -'.sql'.length).replace(/^\d+_/, '')

const snapshotPath = (tag) => join(migrationsDir, 'meta', `${tag.split('_')[0]}_snapshot.json`)

function restore(sqlPath, sql, journalBefore, created) {
  if (created) {
    const generatedSql = join(migrationsDir, `${created.tag}.sql`)
    if (existsSync(generatedSql)) unlinkSync(generatedSql)
    const snapshot = snapshotPath(created.tag)
    if (existsSync(snapshot)) unlinkSync(snapshot)
  }
  writeFileSync(journalPath, journalBefore)
  writeFileSync(sqlPath, sql)
}

function register(fileName) {
  const tag = fileName.slice(0, -'.sql'.length)
  const sqlPath = join(migrationsDir, fileName)
  const sql = readFileSync(sqlPath, 'utf8')
  const journalBefore = journalText()
  unlinkSync(sqlPath)
  try {
    execFileSync(
      'pnpm',
      ['exec', 'drizzle-kit', 'generate', '--custom', '--name', migrationName(fileName)],
      { cwd: root, stdio: 'inherit' },
    )
  } catch (error) {
    writeFileSync(sqlPath, sql)
    throw error
  }
  const added = JSON.parse(journalText()).entries.filter(
    (entry) => !journalTags(journalBefore).has(entry.tag),
  )
  const created = added.length === 1 ? added[0] : undefined
  if (!created || created.tag !== tag) {
    restore(sqlPath, sql, journalBefore, created)
    const createdTag = created ? created.tag : 'no file'
    throw new Error(
      `Drizzle created ${createdTag} for ${fileName}. Name the file with the next migration number.`,
    )
  }
  writeFileSync(sqlPath, sql)
  return [sqlPath, journalPath, snapshotPath(created.tag)]
}

const known = journalTags(journalText())
const changed = []
for (const fileName of sqlFiles()) {
  const tag = fileName.slice(0, -'.sql'.length)
  if (known.has(tag)) continue
  changed.push(...register(fileName))
  known.add(tag)
}

if (changed.length === 0 || process.env.MAILER_SYNC_MIGRATIONS_STAGE !== '1') {
  process.exit(0)
}

execFileSync('git', ['add', '--', ...changed], { cwd: root, stdio: 'inherit' })
