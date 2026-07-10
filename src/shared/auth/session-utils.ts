/**
 * Extract the current session ID from a JWT access token.
 *
 * Supabase Auth includes a `session_id` claim in the JWT payload that
 * uniquely identifies the session. This is used client-side to mark the
 * "current" session in the session list UI — the server-side RPCs use
 * the same claim (via `current_setting`) to identify the current session
 * for self-revocation protection.
 *
 * @returns The session ID string, or null if the token cannot be parsed.
 */
export function getCurrentSessionId(accessToken: string): string | null {
  try {
    const payload = accessToken.split('.')[1]
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return decoded.session_id ?? null
  } catch {
    return null
  }
}
