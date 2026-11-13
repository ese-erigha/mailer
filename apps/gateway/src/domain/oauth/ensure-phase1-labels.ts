import { createLabel, GMAIL_ERROR, GmailRequestError, listLabels } from 'gmail'
import { PHASE_1_LABEL } from 'mailer-domain'

export async function ensurePhase1Labels(accessToken: string): Promise<Record<string, string>> {
  const labels = await listLabels(accessToken)
  const ids = idsByName(labels)
  let conflict = false
  for (const name of PHASE_1_LABEL) {
    if (ids[name]) continue
    try {
      const created = await createLabel(accessToken, name)
      ids[name] = created.id
    } catch (error) {
      if (error instanceof GmailRequestError && error.kind === GMAIL_ERROR.conflict) {
        conflict = true
        continue
      }
      throw error
    }
  }
  if (!conflict) return ids
  const again = await listLabels(accessToken)
  return { ...ids, ...idsByName(again) }
}

function idsByName(labels: Array<{ id: string; name: string }>): Record<string, string> {
  const ids: Record<string, string> = {}
  for (const label of labels) {
    ids[label.name] = label.id
  }
  return ids
}
