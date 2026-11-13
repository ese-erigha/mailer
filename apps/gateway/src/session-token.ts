export function randomUrlToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let token = ''
  for (const byte of bytes) {
    token += byte.toString(16).padStart(2, '0')
  }
  return token
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  const bytes = new Uint8Array(digest)
  let hex = ''
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0')
  }
  return hex
}
