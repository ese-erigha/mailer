export const OAUTH_ERROR_REASON = {
  denied: 'denied',
  exchange: 'exchange',
  scope: 'scope',
  watch: 'watch',
  state: 'state',
} as const

export type OauthErrorReason = (typeof OAUTH_ERROR_REASON)[keyof typeof OAUTH_ERROR_REASON]
