import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test'

import { resetUserData } from './helpers/db'
import {
  clickEntryNav,
  clickFirstEntry,
  clickSidebarButton,
  entryIdFromUrl,
  entryNavLocator,
} from './helpers/navigation'
import { login, registerUser, uniqueUsername } from './helpers/users'

/**
 * Realtime sync E2E — cross-session propagation against the production preview
 * build, with real crypto + Supabase Realtime postgres_changes broadcasts.
 *
 * Two browser contexts (= two devices/tabs) log in as the SAME user:
 *   - A registers the user (real Argon2id) and drives the mutating flow.
 *   - B logs in via the real /login flow (real Argon2id + vault unlock) and
 *     asserts the change propagates WITHOUT a reload — the realtime channel
 *     delivered it, the query was invalidated, and the field re-decrypted with
 *     the key already in B's vault.
 *
 * `beforeEach` truncates `auth.users` + `private.rate_limits` so neither
 * context's `get_login_salts` pre-auth RPC trips the shared-IP limiter.
 *
 * Subscription ordering: Supabase `postgres_changes` does NOT replay events
 * that occur before a channel is SUBSCRIBED, so B must be subscribed before A
 * mutates. B's /login + navigation takes ~2s, during which the channel
 * connects; a short wait before A act plus auto-retry on the cross-session
 * assertion absorbs delivery latency.
 */

const PASSWORD = 'TestPass123!'

/** Auto-retry budget for cross-session assertions: realtime delivery + refetch + decrypt. */
const CROSS_SESSION_TIMEOUT = 20_000

/** Safety margin so B's realtime channel is SUBSCRIBED before A mutates. */
const SUBSCRIBE_SETTLE_MS = 1500

/**
 * Opens a second browser context (= a second device) and logs in as the same
 * user via the real /login flow. Returns B's page and a `close` that tears the
 * context down. Each test creates and closes its own second context — Playwright
 * only auto-closes the fixture context (A).
 */
async function openSecondSession(
  browser: Browser,
  username: string,
  password: string,
): Promise<{ pageB: Page; close: () => Promise<void> }> {
  const contextB = await browser.newContext()
  const pageB = await contextB.newPage()
  await login(pageB, username, password)
  return { pageB, close: () => contextB.close() }
}

test.describe('realtime', () => {
  test.beforeEach(async () => {
    await resetUserData()
  })

  test('a field edit in session A appears in session B without a reload', async ({ page: pageA, browser }, testInfo: TestInfo) => {
    const username = uniqueUsername('rtedit')
    await registerUser(pageA, username, PASSWORD)
    // Registration auto-creates entry #1; open it in A so A has a field to edit.
    await clickFirstEntry(pageA, testInfo)
    await expect(pageA).toHaveURL(/\/dashboard\/[^/]+$/)
    const entryId = entryIdFromUrl(pageA)

    const sessionB = await openSecondSession(browser, username, PASSWORD)
    try {
      const { pageB } = sessionB
      // B navigates to the SAME entry; its note field is empty (fresh entry).
      await clickEntryNav(pageB, entryId, testInfo)
      await expect(pageB).toHaveURL(new RegExp(`/dashboard/${entryId}$`))
      await expect(pageB.getByTestId('field-input-note')).toHaveValue('')
      // Let B's realtime channel finish subscribing before A mutates.
      await pageB.waitForTimeout(SUBSCRIBE_SETTLE_MS)

      // A types and auto-saves (debounce + network + server write + broadcast).
      const noteValue = `Realtime edit from A — ${entryId.slice(0, 6)}`
      await pageA.getByTestId('field-input-note').fill(noteValue)
      await expect(pageA.getByTestId('field-card-note').getByTestId('save-indicator')).toHaveText('Saved')

      // B's onFieldChange: not an echo (B never saved), no pending save →
      // invalidate field.detail → refetch → re-decrypt with B's note key → the
      // input updates in place, no reload.
      await expect(pageB.getByTestId('field-input-note')).toHaveValue(noteValue, {
        timeout: CROSS_SESSION_TIMEOUT,
      })
    } finally {
      await sessionB.close()
    }
  })

  test('an entry created in session A appears in session B sidebar', async ({ page: pageA, browser }, testInfo: TestInfo) => {
    const username = uniqueUsername('rtcreate')
    await registerUser(pageA, username, PASSWORD)
    // A is on /dashboard with the single auto-created entry.

    const sessionB = await openSecondSession(browser, username, PASSWORD)
    try {
      const { pageB } = sessionB
      // B lands on /dashboard; let its realtime channel subscribe before A acts.
      await pageB.waitForTimeout(SUBSCRIBE_SETTLE_MS)

      // A creates a second entry via the sidebar "New note" button.
      await clickSidebarButton(pageA, testInfo, 'create-entry')
      await expect(pageA).toHaveURL(/\/dashboard\/[^/]+$/)
      const newEntryId = entryIdFromUrl(pageA)

      // B's onEntryChange (INSERT) invalidates the entry list → sidebar
      // refetches → the new entry-nav-item renders. Assert by the specific
      // entryId so a pre-existing item can't satisfy the assertion.
      await expect(
        await entryNavLocator(pageB, testInfo, newEntryId),
      ).toBeVisible({ timeout: CROSS_SESSION_TIMEOUT })
    } finally {
      await sessionB.close()
    }
  })

  test('an entry deleted in session A disappears from session B sidebar', async ({ page: pageA, browser }, testInfo: TestInfo) => {
    const username = uniqueUsername('rtdelete')
    await registerUser(pageA, username, PASSWORD)
    // Open the auto-created entry in A so it can be deleted; capture its id.
    await clickFirstEntry(pageA, testInfo)
    await expect(pageA).toHaveURL(/\/dashboard\/[^/]+$/)
    const entryId = entryIdFromUrl(pageA)

    const sessionB = await openSecondSession(browser, username, PASSWORD)
    try {
      const { pageB } = sessionB
      // B sees the entry in its sidebar before the delete.
      await expect(await entryNavLocator(pageB, testInfo, entryId)).toBeVisible()
      await pageB.waitForTimeout(SUBSCRIBE_SETTLE_MS)

      // A deletes the entry through the real DeleteEntryDialog.
      await pageA.getByTestId('delete-entry').click()
      const dialog = pageA.getByRole('alertdialog')
      await expect(dialog).toBeVisible()
      await pageA.getByTestId('delete-entry-confirm').click()
      await expect(pageA).toHaveURL(/\/dashboard$/)

      // B's onEntryChange (DELETE) invalidates the entry list + removes field
      // queries for that entry → the sidebar item disappears.
      await expect(pageB.locator(`[data-testid="entry-nav-item"][data-entry-id="${entryId}"]`)).toHaveCount(0, {
        timeout: CROSS_SESSION_TIMEOUT,
      })
    } finally {
      await sessionB.close()
    }
  })
})
