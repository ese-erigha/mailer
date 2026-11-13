import type { Context } from 'hono'
import { ERROR_CODE, type ErrorCode } from 'mailer-domain'
import type { ZodType } from 'zod'

type HttpStatus = 400 | 401 | 404 | 500

export class RequestError extends Error {
  readonly status: HttpStatus
  readonly code: ErrorCode

  constructor(status: HttpStatus, code: ErrorCode, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export type ErrorDetails = {
  code: ErrorCode
  message: string
}

export type ErrorEnvelope = {
  error: ErrorDetails
}

export type ErrorBody = {
  status: HttpStatus
  body: ErrorEnvelope
}

export function parseRequest<T>(schema: ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new RequestError(400, ERROR_CODE.validationFailed, 'The request is invalid.')
  return parsed.data
}

export function handleErrors(c: Context, error: unknown): Response {
  const mapped = errorBody(error)
  return c.json(mapped.body, mapped.status)
}

export function errorBody(error: unknown): ErrorBody {
  if (error instanceof RequestError) {
    return { status: error.status, body: { error: { code: error.code, message: error.message } } }
  }
  return { status: 500, body: { error: { code: ERROR_CODE.internal, message: 'Something went wrong.' } } }
}
