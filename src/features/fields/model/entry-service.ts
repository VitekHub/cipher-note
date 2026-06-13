import { fetchEntries, createEntry, deleteEntry } from '@/shared/api/supabase-entries'
import type { ServerEntry } from '@/shared/types/entities/entry.types'

class EntryService {
  /** Fetch all entries for a user, ordered by creation time. */
  async fetchEntries(userId: string): Promise<ServerEntry[]> {
    return fetchEntries(userId)
  }

  /** Create a new entry. Returns the created entry. */
  async createEntry(userId: string): Promise<ServerEntry> {
    return createEntry(userId)
  }

  /** Delete an entry. ON DELETE CASCADE removes associated encrypted_fields. */
  async deleteEntry(entryId: string): Promise<void> {
    return deleteEntry(entryId)
  }
}

export const entryService = new EntryService()
