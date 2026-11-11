export const TOKEN_KEY_BYTES = 32

export type RefreshTokenRecord = {
  ciphertext: Uint8Array
  nonce: Uint8Array
  keyVersion: number
}
