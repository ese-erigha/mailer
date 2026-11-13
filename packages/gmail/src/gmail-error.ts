export const GMAIL_ERROR = {
  notFound: 'not_found',
  conflict: 'conflict',
  unauthorized: 'unauthorized',
  rateLimited: 'rate_limited',
  invalidGrant: 'invalid_grant',
  rejected: 'rejected',
} as const

export type GmailErrorKind = (typeof GMAIL_ERROR)[keyof typeof GMAIL_ERROR]

export class GmailRequestError extends Error {
  readonly kind: GmailErrorKind
  readonly status: number

  constructor(kind: GmailErrorKind, status: number) {
    super(`Gmail request failed with status ${status}.`)
    this.kind = kind
    this.status = status
  }
}

export function gmailErrorKind(status: number): GmailErrorKind {
  if (status === 401) return GMAIL_ERROR.unauthorized
  if (status === 404) return GMAIL_ERROR.notFound
  if (status === 409) return GMAIL_ERROR.conflict
  if (status === 429) return GMAIL_ERROR.rateLimited
  return GMAIL_ERROR.rejected
}
