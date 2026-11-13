import { useSearchParams } from 'react-router-dom'

import { OAUTH_ERROR_REASON } from 'mailer-domain'

const REASON_TEXT = {
  [OAUTH_ERROR_REASON.denied]: 'You denied Mailer access to Gmail.',
  [OAUTH_ERROR_REASON.exchange]: 'Mailer could not finish connecting to Google.',
  [OAUTH_ERROR_REASON.scope]: 'Mailer needs permission to manage Gmail labels. Allow every requested permission.',
  [OAUTH_ERROR_REASON.watch]: 'Mailer could not start watching the inbox.',
  [OAUTH_ERROR_REASON.state]: 'The connection attempt expired. Try again.',
} as const

export function ErrorScreen() {
  const [params] = useSearchParams()
  const reason = params.get('reason')
  const text = reason && reason in REASON_TEXT ? REASON_TEXT[reason as keyof typeof REASON_TEXT] : REASON_TEXT.exchange
  return (
    <main className="mx-auto max-w-xl px-6 py-16 font-sans text-neutral-900">
      <h1 className="text-3xl font-semibold">Connection failed</h1>
      <p className="mt-4">{text}</p>
      <a className="mt-6 inline-block rounded bg-neutral-900 px-4 py-2 text-white" href="/v1/oauth/authorization">
        Try again
      </a>
    </main>
  )
}
