export const ERROR_CODE = {
  unauthorized: 'unauthorized',
  notFound: 'not_found',
  validationFailed: 'validation_failed',
  internal: 'internal',
} as const

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE]
