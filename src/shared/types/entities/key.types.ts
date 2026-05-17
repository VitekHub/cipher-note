import type { FieldName } from './field.types'

export type KeyVersions = Record<FieldName, number>

export interface FieldKeyEntry {
  fieldName: string
  version: number
  wrappedKey: string
  keyIV: string
}
