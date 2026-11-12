export const TOKEN_KEY_BYTES = 32

export type RefreshTokenRecord = {
  encryptedRefreshToken: Uint8Array
  encryptionNonce: Uint8Array
}
