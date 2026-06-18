export const ENTRY_STATUS = {
  LOADING: 'loading',
  VALID: 'valid',
  NOT_FOUND: 'not_found',
  DELETED: 'deleted',
} as const

export type EntryStatus = (typeof ENTRY_STATUS)[keyof typeof ENTRY_STATUS]
