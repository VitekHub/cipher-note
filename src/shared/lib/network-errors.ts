/**
 * Check whether an error represents a network failure.
 *
 * Catches raw browser errors (TypeError "Failed to fetch") and Supabase
 * network errors that can reach the UI without being wrapped by an adapter.
 * Used by both AuthError and ApiError wrappers to classify network failures.
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message === 'Failed to fetch') return true
  if (error instanceof Error) {
    const msg = error.message
    if (msg === 'Failed to fetch' || msg === 'NetworkError') return true
    const lower = msg.toLowerCase()
    if (lower.includes('network') || lower.includes('failed to fetch')) return true
  }
  return false
}
