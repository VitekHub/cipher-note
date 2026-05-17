const CIPHERNOTE_INTERNAL_DOMAIN = '@ciphernote.internal'
const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/

export function toSupabaseEmail(username: string): string {
  const normalized = username.toLowerCase()
  if (!USERNAME_PATTERN.test(normalized)) {
    throw new Error(`Invalid username: "${username}". Use 3-32 lowercase letters, digits, or underscores.`)
  }
  return `${normalized}${CIPHERNOTE_INTERNAL_DOMAIN}`
}

export function fromSupabaseEmail(email: string): string {
  if (email.endsWith(CIPHERNOTE_INTERNAL_DOMAIN)) {
    return email.slice(0, -CIPHERNOTE_INTERNAL_DOMAIN.length)
  }
  return email
}

export function isCiphernoteInternalEmail(email: string): boolean {
  return email.endsWith(CIPHERNOTE_INTERNAL_DOMAIN)
}
