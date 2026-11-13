import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { disconnectMailbox, readMailbox, type MailboxView } from '../mailbox-api.ts'
import { ROUTE } from '../routes.ts'

export function ConnectedScreen() {
  const navigate = useNavigate()
  const [mailbox, setMailbox] = useState<MailboxView | null>(null)

  useEffect(() => {
    let active = true
    async function loadMailbox(): Promise<void> {
      const result = await readMailbox()
      if (!active) return
      if (!result) navigate(ROUTE.home)
      setMailbox(result)
    }
    void loadMailbox()
    return () => {
      active = false
    }
  }, [navigate])

  async function confirmDisconnect(): Promise<void> {
    const confirmed = window.confirm('Disconnect Mailer from this Gmail account?')
    if (!confirmed) return
    await disconnectMailbox()
    navigate(ROUTE.home)
  }

  if (!mailbox) return <main className="mx-auto max-w-xl px-6 py-16">Loading the mailbox.</main>

  return (
    <main className="mx-auto max-w-xl px-6 py-16 font-sans text-neutral-900">
      <h1 className="text-3xl font-semibold">Connected</h1>
      <p className="mt-4">{mailbox.email}</p>
      <p className="mt-2">Watch active until {mailbox.watchExpiresAt}</p>
      <p className="mt-2">{mailbox.lastLabeledAt ? `Last labeled ${mailbox.lastLabeledAt}` : 'No mail labeled yet'}</p>
      {mailbox.accessEndsAt ? <p className="mt-2">Google ends access on {mailbox.accessEndsAt}. Connect again before that date.</p> : null}
      <button className="mt-6 rounded border px-4 py-2" type="button" onClick={confirmDisconnect}>
        Disconnect
      </button>
    </main>
  )
}
