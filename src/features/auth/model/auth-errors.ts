import type { TFunction } from 'i18next'

interface ErrorWithStatus {
  message: string
  status?: number
}

function isErrorWithStatus(error: unknown): error is ErrorWithStatus {
  return error instanceof Error && 'status' in error
}

export function getAuthErrorMessage(error: unknown, t: TFunction<'auth'>): string {
  if (isErrorWithStatus(error)) {
    const status = (error as ErrorWithStatus).status
    if (status === 401 || status === 403) return t('errors.invalidCredentials')
    if (status === 409 || status === 422) return t('errors.usernameTaken')
  }

  if (error instanceof Error) {
    const msg = error.message

    if (msg === 'Invalid login credentials' || msg === 'Invalid password') {
      return t('errors.invalidCredentials')
    }
    if (msg === 'User already registered' || msg === 'User already exists') {
      return t('errors.usernameTaken')
    }
    if (msg === 'Failed to fetch' || msg === 'NetworkError') {
      return t('errors.networkError')
    }

    const lower = msg.toLowerCase()
    if (lower.includes('network') || lower.includes('failed to fetch')) {
      return t('errors.networkError')
    }
  }

  return t('errors.unexpectedError')
}
