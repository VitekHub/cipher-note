import { expect, test, type Page } from '@playwright/test'

import { queryRaw, resetUserData } from './helpers/db'
import { createEntry, clickSidebarButton } from './helpers/navigation'
import { registerUser, uniqueUsername } from './helpers/users'

/**
 * Security E2E — RLS isolation and at-rest confidentiality, against the
 * production preview build with real crypto.
 *
 * Two concerns, per docs/e2ee-plan.md:
 *   1. RLS: a second authenticated user cannot read another user's
 *      `encrypted_fields` by id. Query PostgREST as user B (with B's real
 *      Supabase access token, grabbed from the browser session after a UI
 *      login) for one of A's entry rows — RLS must filter it to an empty set.
 *   2. At-rest confidentiality: the server never stores plaintext. Via the
 *      service-role `pg` connection (RLS bypass) inspect A's
 *      `encrypted_fields.ciphertext` and assert it does not contain the typed
 *      plaintext substring; inspect A's `auth.users.encrypted_password` and
 *      assert it is neither the plaintext password nor the raw 64-hex-char
 *      `authHash` (Supabase bcrypt-hashes the supplied authHash).
 *
 * Each test registers fresh users (seed users carry placeholder key material
 * that cannot be unwrapped) and runs real Argon2id in the worker. `beforeEach`
 * truncates `auth.users` + `private.rate_limits` so no pre-auth RPC trips the
 * shared-IP limiter.
 */

const PASSWORD = 'TestPass123!'

/** Distinctive plaintext typed into A's title field; used as the leak canary. */
const TITLE_PLAINTEXT = 'TopSecretLeakCanary-Title'

test.describe('security', () => {
  test.beforeEach(async () => {
    await resetUserData()
  })

  /**
   * Reads the current Supabase session's access token from the page's
   * localStorage. supabase-js v2 persists the session under a
   * `sb-<ref>-auth-token` key; the access token is what the PostgREST
   * `Authorization: Bearer` header expects. Used to issue a server-side request
   * carrying B's identity without re-deriving the authHash in Node (which would
   * duplicate the split-KDF flow the suite exercises through the UI).
   */
  async function extractAccessToken(page: Page): Promise<string> {
    const storage = await page.evaluate(() => ({ ...localStorage }))
    const tokenKey = Object.keys(storage).find((key) => /^sb-.*-auth-token$/.test(key))
    if (!tokenKey) {
      throw new Error(`No Supabase auth token found in localStorage. Keys: ${Object.keys(storage).join(', ')}`)
    }
    // The stored value is the JSON-serialized session. Handle both the flat
    // shape ({ access_token, ... }) and the nested shape ({ session: { ... } })
    // across supabase-js versions.
    const parsed = JSON.parse(storage[tokenKey]) as Record<string, unknown>
    const session = (parsed.session as Record<string, unknown> | undefined) ?? parsed
    const accessToken = session?.access_token
    if (typeof accessToken !== 'string') {
      throw new Error(`Supabase session payload has no string access_token: ${storage[tokenKey]}`)
    }
    return accessToken
  }

  /**
   * Queries PostgREST as the given user for `encrypted_fields` rows belonging
   * to `entryId`. RLS scopes the result to `user_id = auth.uid()`, so a
   * non-owner receives `[]` (200 OK, filtered) rather than an error.
   */
  async function fetchEncryptedFieldsAs(accessToken: string, entryId: string): Promise<unknown[]> {
    const url = process.env.VITE_SUPABASE_URL
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY
    if (!url || !anonKey) {
      throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY must be set in .env.local')
    }
    const res = await fetch(`${url}/rest/v1/encrypted_fields?entry_id=eq.${encodeURIComponent(entryId)}&select=id`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) {
      throw new Error(`PostgREST request failed: ${res.status} ${await res.text()}`)
    }
    return (await res.json()) as unknown[]
  }

  test("RLS blocks a second user from reading another user's encrypted fields", async ({ page }, testInfo) => {
    // --- User A: register, create an entry, and persist a known title. ---
    const usernameA = uniqueUsername('secA')
    await registerUser(page, usernameA, PASSWORD)
    const entryId = await createEntry(page, testInfo)
    await page.getByTestId('field-input-title').fill(TITLE_PLAINTEXT)
    await expect(page.getByTestId('field-card-title').getByTestId('save-indicator')).toHaveText('Saved')

    // Log out so the same browser session can register and authenticate as B.
    await clickSidebarButton(page, testInfo, 'logout-button')
    await expect(page).toHaveURL(/\/login$/)

    // --- User B: register on the same page. localStorage now holds B's session. ---
    const usernameB = uniqueUsername('secB')
    await registerUser(page, usernameB, PASSWORD)

    // --- B attempts to read A's encrypted_fields by entry_id via PostgREST. ---
    const accessToken = await extractAccessToken(page)
    const rows = await fetchEncryptedFieldsAs(accessToken, entryId)

    // RLS restricts SELECT to `user_id = auth.uid()`; B ≠ A, so the row set is
    // empty even though the row exists (confirmed by the test below).
    expect(rows).toEqual([])
  })

  test('stored ciphertext and auth hash never contain the plaintext password', async ({ page }, testInfo) => {
    const usernameA = uniqueUsername('leak')
    await registerUser(page, usernameA, PASSWORD)
    const entryId = await createEntry(page, testInfo)
    await page.getByTestId('field-input-title').fill(TITLE_PLAINTEXT)
    await expect(page.getByTestId('field-card-title').getByTestId('save-indicator')).toHaveText('Saved')

    // --- Ciphertext must not leak the plaintext substring. ---
    // Service-role connection bypasses RLS, so this reads A's actual rows.
    const fieldRows = await queryRaw<{ ciphertext: string }>(
      'SELECT ciphertext FROM public.encrypted_fields WHERE entry_id = $1',
      [entryId],
    )
    expect(fieldRows.length).toBeGreaterThan(0)
    for (const row of fieldRows) {
      // AES-256-GCM ciphertext is base64; a substring match would mean the
      // plaintext was stored verbatim. Covers every field of the entry.
      expect(row.ciphertext).not.toContain(TITLE_PLAINTEXT)
    }

    // --- auth.users.encrypted_password must be bcrypt-hashed, not raw. ---
    // Username maps to `{username}@ciphernote.internal` for Supabase Auth.
    const authRows = await queryRaw<{ encrypted_password: string }>(
      'SELECT encrypted_password FROM auth.users WHERE email = $1',
      [`${usernameA}@ciphernote.internal`],
    )
    expect(authRows).toHaveLength(1)
    const hashed = authRows[0].encrypted_password

    // The plaintext password must never be stored verbatim.
    expect(hashed).not.toBe(PASSWORD)
    // Supabase bcrypt-hashes the supplied authHash; the stored value must look
    // like a bcrypt hash, not the raw 64-hex-char authHash the client sends.
    expect(hashed).toMatch(/^\$2[abxy]\$\d{2}\$/)
    expect(hashed).not.toMatch(/^[0-9a-f]{64}$/)
  })
})
