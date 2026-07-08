import { Pool, type PoolConfig, type QueryResult, type QueryResultRow } from 'pg'

/**
 * Direct-Postgres helper for E2E specs. Connects as the local `postgres`
 * superuser (RLS bypass) to do what PostgREST cannot: truncate `auth.users` /
 * `private.rate_limits` between specs, and read raw ciphertext /
 * `auth.users.encrypted_password` for security assertions.
 *
 * Defaults to the local Supabase URL from `supabase status`. Override with
 * `E2E_DB_URL` if your instance uses a non-default password.
 */

const dbUrl = process.env.E2E_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const poolConfig: PoolConfig = {
  connectionString: dbUrl,
  // The suite runs serially (workers: 1) — a single connection is enough and
  // avoids idle-clients holding the local Postgres connection limit.
  max: 1,
}

let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) pool = new Pool(poolConfig)
  return pool
}

/**
 * Truncates all user data between spec files. `auth.users` is the root of the
 * FK tree: `public.users` references it with ON DELETE CASCADE, and every
 * public table (`login_salts`, `master_keys`, `field_keys`, `entries` →
 * `encrypted_fields`, `recovery_keys`) cascades from it. Clearing
 * `private.rate_limits` resets the pre-auth RPC counters (login salts,
 * username check, recovery) so the next spec never trips them. Fast (<1s) —
 * avoids a full `supabase db reset` per spec.
 */
export async function resetUserData(): Promise<void> {
  const client = await getPool().connect()
  try {
    await client.query('TRUNCATE "auth"."users" CASCADE')
    await client.query('TRUNCATE "private"."rate_limits"')
  } finally {
    client.release()
  }
}

/**
 * Runs an arbitrary SQL query with service-role access (RLS bypass) for
 * security-spec DB assertions — e.g. inspecting `encrypted_fields.ciphertext`
 * for a plaintext leak, or confirming `auth.users.encrypted_password` is
 * neither the raw password nor the raw `authHash`.
 */
export async function queryRaw<R extends QueryResultRow>(
  sql: string,
  params?: unknown[],
): Promise<QueryResult<R>['rows']> {
  const result = await getPool().query<R>(sql, params ?? [])
  return result.rows
}

/** Closes the connection pool. Call from a global teardown or suite afterAll. */
export async function closeDb(): Promise<void> {
  if (!pool) return
  await pool.end()
  pool = null
}
