/** An entry — a group of 4 encrypted fields (title, note, website, email). */
export interface Entry {
  id: string
  userId: string
  createdAt: string
  updatedAt: string
}

/** An entry as returned by Supabase (snake_case → camelCase mapping). */
export interface ServerEntry {
  id: string
  user_id: string
  created_at: string
  updated_at: string
}

/** Convert a Supabase row to an Entry. */
export function toEntry(server: ServerEntry): Entry {
  return {
    id: server.id,
    userId: server.user_id,
    createdAt: server.created_at,
    updatedAt: server.updated_at,
  }
}
