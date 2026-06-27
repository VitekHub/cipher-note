import type { FieldName } from '@/shared/types/entities/field.types'

export const queryKeys = {
  usernameAvailability: {
    all: ['username-availability'] as const,
    check: (username: string) => [...queryKeys.usernameAvailability.all, username] as const,
  },
  field: {
    all: ['field'] as const,
    byEntry: (entryId: string) => [...queryKeys.field.all, entryId] as const,
    detail: (entryId: string, fieldName: FieldName) => [...queryKeys.field.all, entryId, fieldName] as const,
    save: (entryId: string, fieldName: FieldName) => ['field-save', entryId, fieldName] as const,
  },
  entry: {
    all: ['entry'] as const,
    list: (userId: string) => [...queryKeys.entry.all, userId] as const,
  },
} as const
