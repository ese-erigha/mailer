export const GOOGLE_SCOPE = {
  openid: 'openid',
  email: 'email',
  profile: 'profile',
  gmailModify: 'https://www.googleapis.com/auth/gmail.modify',
} as const

export const GOOGLE_AUTHORIZATION_SCOPES = [
  GOOGLE_SCOPE.openid,
  GOOGLE_SCOPE.email,
  GOOGLE_SCOPE.profile,
  GOOGLE_SCOPE.gmailModify,
] as const
