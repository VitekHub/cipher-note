import { isNetworkError } from '@/shared/lib/network-errors'

export const ApiErrorCode = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNEXPECTED: 'UNEXPECTED',
} as const

export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode]

export class ApiError extends Error {
  readonly code: ApiErrorCode

  constructor(code: ApiErrorCode, options?: ErrorOptions) {
    super(`ApiError: ${code}`, options)
    this.name = 'ApiError'
    this.code = code
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export function wrapApiError(error: unknown): ApiError {
  const cause = error instanceof Error ? error : undefined
  if (isNetworkError(error)) {
    return new ApiError(ApiErrorCode.NETWORK_ERROR, { cause })
  }
  return new ApiError(ApiErrorCode.UNEXPECTED, { cause })
}
