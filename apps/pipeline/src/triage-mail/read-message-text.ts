import type { GmailMessage, GmailPayload } from 'gmail'
import { ACTIVITY_SUBJECT_MAX_CHARS, CLASSIFY_MAX_BODY_CHARS } from 'mailer-domain'

export type MessageText = {
  subject: string
  from: string
  text: string
}

export function readMessageText(message: GmailMessage): MessageText {
  return {
    subject: header(message.payload, 'Subject').slice(0, ACTIVITY_SUBJECT_MAX_CHARS),
    from: header(message.payload, 'From'),
    text: bodyText(message.payload).slice(0, CLASSIFY_MAX_BODY_CHARS),
  }
}

function header(payload: GmailPayload, name: string): string {
  for (const item of payload.headers ?? []) {
    if (item.name.toLowerCase() === name.toLowerCase()) return item.value
  }
  return ''
}

function bodyText(payload: GmailPayload): string {
  const stack = [payload]
  let plain = ''
  let html = ''
  while (stack.length > 0) {
    const part = stack.pop()
    if (!part) continue
    for (const child of part.parts ?? []) stack.push(child)
    if (!part.body?.data || part.filename) continue
    const text = decodeBase64Url(part.body.data)
    if (part.mimeType === 'text/plain' && !plain) plain = text
    if (part.mimeType === 'text/html' && !html) html = text
  }
  if (plain) return plain
  return html.replace(/<[^>]+>/g, ' ')
}

function decodeBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new TextDecoder().decode(bytes)
}
