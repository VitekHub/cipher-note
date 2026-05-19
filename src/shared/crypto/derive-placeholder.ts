/**
 * Placeholder credential derivation until Step 14 implements Argon2id.
 * Produces 64-char hex strings matching the expected output format.
 * NOT cryptographically secure — replace before production.
 */

export interface DerivedCredentials {
  authHash: string
  passwordKey: string
  keySalt: string
  authSalt: string
}

const encoder = new TextEncoder()

export async function deriveCredentials(username: string, password: string): Promise<DerivedCredentials> {
  await new Promise((resolve) => setTimeout(resolve, 100))

  const authSalt = await sha256(`cipher-note:auth-salt:${username}`)
  const keySalt = await sha256(`cipher-note:key-salt:${username}`)
  const authHash = await sha256(`cipher-note:auth-hash:${username}:${password}:${authSalt}`)
  const passwordKey = await sha256(`cipher-note:password-key:${password}:${keySalt}`)

  return { authHash, passwordKey, keySalt, authSalt }
}

async function sha256(input: string): Promise<string> {
  const data = encoder.encode(input)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return bufToHex(buf)
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
