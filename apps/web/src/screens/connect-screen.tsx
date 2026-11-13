import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { readMailbox } from '../mailbox-api.ts'
import { ROUTE } from '../routes.ts'

export function ConnectScreen() {
  const navigate = useNavigate()
  const [ended, setEnded] = useState(false)

  useEffect(() => {
    let active = true
    async function loadMailbox(): Promise<void> {
      const mailbox = await readMailbox()
      if (!active || !mailbox) return
      if (mailbox.status === 'connected') navigate(ROUTE.connected)
      if (mailbox.status === 'disconnected') setEnded(true)
    }
    void loadMailbox()
    return () => {
      active = false
    }
  }, [navigate])

  return (
    <main className="mx-auto max-w-xl px-6 py-16 font-sans text-neutral-900">
      <h1 className="text-3xl font-semibold">Mailer</h1>
      <p className="mt-4 text-lg">Mailer labels new Gmail mail. You send replies in Gmail.</p>
      <ul className="mt-6 list-disc pl-5">
        <li>Label new mail</li>
        <li>Optional drafts later</li>
        <li>The activity list later</li>
        <li>Disconnect at any time</li>
      </ul>
      <p className="mt-6">Google's permission includes sending mail. Mailer does not send mail.</p>
      {ended ? <p className="mt-4">Google ended Mailer's access. Connect again to resume labels.</p> : null}
      <a className="mt-6 inline-block rounded bg-neutral-900 px-4 py-2 text-white" href="/v1/oauth/authorization">
        Connect Gmail
      </a>
    </main>
  )
}
