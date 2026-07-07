import { execSync } from 'node:child_process'
import type { FullConfig } from '@playwright/test'

/**
 * Global E2E setup. Runs once before the suite.
 *
 * 1. Verifies local Supabase is reachable (fail fast — E2E needs Docker +
 *    `pnpm supabase:start`).
 * 2. Verifies the env vars the suite depends on are present in `.env.local`
 *    (loaded by playwright.config.ts).
 * 3. Resets the database (`supabase db reset`) so every run starts from a clean
 *    schema + seed with rate-limit counters cleared. This is the one slow reset
 *    (~10s); per-spec isolation is handled by the DB helpers.
 */
async function globalSetup(_config: FullConfig) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    throw new Error(
      [
        'E2E env vars missing.',
        'Copy .env.local.example to .env.local and fill VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY',
        'from `pnpm supabase:status`.',
      ].join(' '),
    )
  }

  await assertSupabaseReachable(supabaseUrl)

  console.info('[e2e] Resetting local Supabase database (supabase db reset)...')
  try {
    execSync('supabase db reset', { stdio: 'inherit' })
  } catch {
    throw new Error(
      '`supabase db reset` failed. Ensure Supabase is running (pnpm supabase:start) and the CLI is available.',
    )
  }
  console.info('[e2e] Database reset complete.')
}

async function assertSupabaseReachable(supabaseUrl: string) {
  const healthUrl = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/health`
  try {
    const res = await fetch(healthUrl, { signal: AbortSignal.timeout(5_000) })
    if (!res.ok) {
      throw new Error(`health endpoint returned ${res.status}`)
    }
  } catch (err) {
    throw new Error(
      `Local Supabase is not reachable at ${supabaseUrl} (${(err as Error).message}). ` +
        'Start it with `pnpm supabase:start` (requires Docker).',
      { cause: err },
    )
  }
}

export default globalSetup
