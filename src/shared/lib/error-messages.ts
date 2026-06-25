import type { TFunction } from 'i18next'
import { isAuthError, type AuthErrorCode } from '@/shared/auth/auth-errors'
import { isApiError, type ApiErrorCode } from '@/shared/api/api-errors'
import { isNetworkError } from '@/shared/lib/network-errors'

/**
 * Declarative spec for mapping errors to i18n message keys.
 *
 * `mapErrorToMessage` checks fields in order:
 * 1. `instanceChecks` — first match wins
 * 2. `authCodes` — looked up if error is AuthError; unmapped codes fall through
 * 3. `apiCodes` — looked up if error is ApiError; unmapped codes fall through
 * 4. `networkKey` — used if error is a network error
 * 5. `fallbackKey` — always defined, used when nothing else matches
 */
export interface ErrorKeySpec {
  /** Instance-of checks → i18n key (checked first, first match wins). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- constructors have varying signatures; this matches ErrorBoundary's pattern
  instanceChecks?: ReadonlyArray<readonly [new (...args: any[]) => Error, string]>
  /** AuthErrorCode → i18n key (checked if error is AuthError; unmapped codes fall through). */
  authCodes?: Readonly<Partial<Record<AuthErrorCode, string>>>
  /** ApiErrorCode → i18n key (checked if error is ApiError; unmapped codes fall through). */
  apiCodes?: Readonly<Partial<Record<ApiErrorCode, string>>>
  /** i18n key for network errors. */
  networkKey?: string
  /** Fallback i18n key (required). */
  fallbackKey: string
}

/**
 * Generic error-to-i18n mapper. Dispatches through the spec in order:
 * instanceChecks → authCodes → apiCodes → networkKey → fallbackKey.
 */
export function mapErrorToMessage(error: unknown, t: TFunction, spec: ErrorKeySpec): string {
  // 1. Instance-of checks (first match wins)
  if (spec.instanceChecks) {
    for (const [ErrorClass, key] of spec.instanceChecks) {
      if (error instanceof ErrorClass) return t(key)
    }
  }

  // 2. AuthError code mapping
  if (spec.authCodes && isAuthError(error)) {
    const key = spec.authCodes[error.code]
    if (key !== undefined) return t(key)
  }

  // 3. ApiError code mapping
  if (spec.apiCodes && isApiError(error)) {
    const key = spec.apiCodes[error.code]
    if (key !== undefined) return t(key)
  }

  // 4. Network error
  if (spec.networkKey && isNetworkError(error)) {
    return t(spec.networkKey)
  }

  // 5. Fallback
  return t(spec.fallbackKey)
}
