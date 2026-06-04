/**
 * Core network error message detection. Used internally by isNetworkError.
 * Checks strings and Error instances for network-related message patterns.
 */
function checkIsNetworkError(error: unknown): boolean {
  // Accept a plain string (e.g. extracted from a non-Error object's .message)
  if (typeof error === 'string') {
    if (error === 'Failed to fetch' || error === 'NetworkError') return true
    const lower = error.toLowerCase()
    if (lower.includes('network') || lower.includes('failed to fetch')) return true
    return false
  }

  if (error instanceof TypeError && error.message === 'Failed to fetch') return true
  if (error instanceof Error) {
    const msg = error.message
    if (msg === 'Failed to fetch' || msg === 'NetworkError') return true
    const lower = msg.toLowerCase()
    if (lower.includes('network') || lower.includes('failed to fetch')) return true
  }
  return false
}

/**
 * Check whether an error represents a network failure.
 *
 * Catches raw browser errors (TypeError "Failed to fetch"), Supabase
 * plain-object errors (PostgrestError is not an Error instance at runtime),
 * and already-wrapped AuthError/ApiError instances with NETWORK_ERROR code.
 */
export function isNetworkError(error: unknown): boolean {
  if (checkIsNetworkError(error)) return true
  // Handle Supabase plain-object errors (PostgrestError not instanceof Error at runtime)
  // https://github.com/supabase/supabase-js/pull/2240
  if (typeof error === 'object' && error !== null && 'message' in error) {
    if (checkIsNetworkError((error as { message: unknown }).message)) return true
  }
  return false
}
