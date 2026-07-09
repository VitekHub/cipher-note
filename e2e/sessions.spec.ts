import { expect, test, type Browser, type Page } from '@playwright/test'

import { resetUserData } from './helpers/db'
import { navigateToSettings } from './helpers/navigation'
import { login, registerUser, uniqueUsername } from './helpers/users'

/**
 * Session management E2E — real RPCs and realtime broadcasts against the
 * production preview build.
 *
 * Tests exercise the full cross-device revocation chain: RPC deletion →
 * Supabase Realtime broadcast → useSessionUpdateListener → isSessionValid →
 * logoutUser → redirect + toast. Two browser contexts simulate two devices
 * logged in as the same user.
 *
 * `beforeEach` truncates `auth.users` + `private.rate_limits` so pre-auth
 * RPCs don't trip the shared-IP rate limiter. Per-test browser contexts
 * isolate Supabase sessions.
 */

const PASSWORD = 'TestPass123!'

/** Auto-retry budget for cross-session assertions: realtime delivery + refetch. */
const CROSS_SESSION_TIMEOUT = 20_000

/** Safety margin so B's realtime channel is SUBSCRIBED before A mutates. */
const SUBSCRIBE_SETTLE_MS = 1500

/**
 * Opens a second browser context (= a second device) and logs in as the same
 * user via the real /login flow. Returns B's page and a `close` that tears
 * the context down. Each test creates and closes its own second context.
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

test.describe('sessions', () => {
  test.beforeEach(async () => {
    await resetUserData()
  })

  test('session list shows the current session in Settings', async ({ page }, testInfo) => {
    const username = uniqueUsername('sesslist')
    await registerUser(page, username, PASSWORD)

    // Navigate to Settings — SessionSection is lazy-loaded, so wait for it.
    await navigateToSettings(page, testInfo)
    await page.waitForURL('**/settings')

    // The session card title should be visible.
    await expect(page.getByText('Sessions', { exact: true })).toBeVisible()

    // The current session row should show "Current device" — this means the
    // session list RPC returned data and getCurrentSessionId matched a row.
    await expect(page.getByText('Current device')).toHaveCount(2)

    // The browser/OS should be parsed from the User-Agent — not "Unknown".
    // Playwright's Chromium UA contains "Chrome" and either "Windows", "macOS",
    // or "Linux". The session row renders "{browser} · {ip} · Last active: {time}".
    // Assert that at least one session row contains a real browser name.
    const sessionBrowser = page.getByTestId('session-browser')
    await expect(sessionBrowser.first()).toContainText(/Chrome|HeadlessChrome|Edge|Firefox/)
  })

  test('revoking another session force-logs out the other device', async ({ page: pageA, browser }, testInfo) => {
    const username = uniqueUsername('sessrevoke')
    await registerUser(pageA, username, PASSWORD)

    // Open a second browser context and log in as the same user.
    const sessionB = await openSecondSession(browser, username, PASSWORD)
    try {
      const { pageB } = sessionB

      // Let B's realtime channel finish subscribing before A acts.
      await pageB.waitForTimeout(SUBSCRIBE_SETTLE_MS)

      // A navigates to Settings and sees 2 sessions.
      await navigateToSettings(pageA, testInfo)
      await pageA.waitForURL('**/settings')
      await expect(pageA.getByText('Sessions', { exact: true })).toBeVisible()

      // Wait for sessions to load — at least one revoke button should appear.
      // (The current session row doesn't have one, so this asserts ≥2 sessions.)
      await expect(pageA.getByTestId('session-revoke-all')).toBeVisible()

      // A clicks "Revoke" on the first other session.
      // Find a revoke button that is NOT the current session's label.
      // SessionRow renders <Button data-testid="session-revoke-{id}"> for
      // other sessions and a <span> for the current one. The first other
      // session's revoke button is the first data-testid matching the pattern.
      const otherSessionRevokeButton = pageA.locator('button[data-testid^="session-revoke-"]').first()
      await otherSessionRevokeButton.click()

      // Confirmation dialog appears.
      const dialog = pageA.getByRole('alertdialog')
      await expect(dialog).toBeVisible()
      await expect(dialog.getByText('Revoke this session?')).toBeVisible()
      // Click the confirm button inside the dialog — scoped to avoid matching
      // the row-level revoke button.
      await dialog.getByRole('button', { name: 'Revoke', exact: true }).click()

      // A sees the success toast.
      await expect(pageA.getByText('Session revoked', { exact: true })).toBeVisible()

      // A's session list now shows only 1 session — "Revoke all others" button
      // should no longer be present (no other sessions to revoke).
      await expect(pageA.getByTestId('session-revoke-all')).not.toBeVisible()

      // B receives the realtime broadcast → isSessionValid() returns false →
      // force-logout with toast + redirect to /login.
      await expect(pageB).toHaveURL(/\/login$/, { timeout: CROSS_SESSION_TIMEOUT })
      // Sonner may truncate long toast messages; assert a unique leading substring.
      await expect(pageB.getByText(/session was revoked from another device/)).toBeVisible()
    } finally {
      await sessionB.close()
    }
  })
})
