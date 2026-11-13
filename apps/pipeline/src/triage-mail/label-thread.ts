import type { MailerRepositories } from 'db'
import { createLabel, GMAIL_ERROR, GmailRequestError, modifyThread, type ModifyThreadInput } from 'gmail'
import { labelForDecision, PHASE_1_LABEL, type MailerDecision } from 'mailer-domain'

export type LabelThreadInput = {
  accessToken: string
  accountId: string
  threadId: string
  decision: MailerDecision
  labelIdByName: string
  repositories: MailerRepositories
}

export async function labelThread(input: LabelThreadInput): Promise<void> {
  const labelName = labelForDecision(input.decision.mailerAction, input.decision.category)
  let ids = JSON.parse(input.labelIdByName) as Record<string, string>
  let addId = ids[labelName]
  if (!addId) {
    const created = await createLabel(input.accessToken, labelName)
    addId = created.id
    ids = { ...ids, [labelName]: addId }
    await input.repositories.mailboxes.updateLabelMap(input.accountId, JSON.stringify(ids), Date.now())
  }
  const removeLabelIds = otherLabelIds(ids, labelName)
  const firstChange: ModifyThreadInput = {
    accessToken: input.accessToken,
    threadId: input.threadId,
    addLabelIds: [addId],
    removeLabelIds,
  }
  try {
    await modifyThread(firstChange)
  } catch (error) {
    if (!(error instanceof GmailRequestError) || error.kind !== GMAIL_ERROR.notFound) throw error
    const created = await createLabel(input.accessToken, labelName)
    ids = { ...ids, [labelName]: created.id }
    await input.repositories.mailboxes.updateLabelMap(input.accountId, JSON.stringify(ids), Date.now())
    const retry: ModifyThreadInput = {
      accessToken: input.accessToken,
      threadId: input.threadId,
      addLabelIds: [created.id],
      removeLabelIds,
    }
    await modifyThread(retry)
  }
}

function otherLabelIds(ids: Record<string, string>, keep: string): string[] {
  const remove: string[] = []
  for (const name of PHASE_1_LABEL) {
    if (name !== keep && ids[name]) remove.push(ids[name])
  }
  return remove
}
