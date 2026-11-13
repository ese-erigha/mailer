export type GoogleIdentity = {
  sub: string
  email: string
  emailVerified: boolean
}

export function readIdToken(idToken: string): GoogleIdentity {
  const payload = idToken.split('.')[1]
  if (!payload) throw new Error('The id token has no payload.')
  const json = JSON.parse(base64Url(payload)) as { sub?: string; email?: string; email_verified?: boolean }
  if (!json.sub || !json.email) throw new Error('The id token is missing the account.')
  return { sub: json.sub, email: json.email.toLowerCase(), emailVerified: json.email_verified === true }
}

function base64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  return atob(padded)
}
