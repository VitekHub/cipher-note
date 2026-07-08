import { expect, test } from '@playwright/test'

import { resetUserData } from './helpers/db'
import { clickSidebarButton, clickSidebarButtonByName } from './helpers/navigation'
import { login, registerUser, uniqueUsername } from './helpers/users'

/**
 * Auth flow E2E — real crypto against the production preview build.
 *
 * Each test registers a fresh user (seed users carry placeholder key material
 * that cannot be unwrapped) and runs real Argon2id in the worker. `beforeEach`
 * truncates `auth.users` + `private.rate_limits` so no pre-auth RPC (login
 * salts, username check) trips the shared-IP limiter. Per-test browser contexts
 * isolate Supabase sessions.
 */

const PASSWORD = 'TestPass123!'

test.describe('auth', () => {
  test.beforeEach(async () => {
    await resetUserData()
  })

  test('register shows a 12-word mnemonic and lands on the dashboard welcome', async ({ page }) => {
    const username = uniqueUsername('reg')
    const { mnemonic } = await registerUser(page, username, PASSWORD)

    // registerUser already asserted the cell count; re-assert on the string.
    expect(mnemonic.split(' ').filter(Boolean)).toHaveLength(12)

    // Registration auto-unlocks the vault and auto-creates a first entry, so
    // /dashboard shows DashboardWelcome — not EmptyState.
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByText(`Welcome ${username}`)).toBeVisible()
  })

  test('login with the correct password reaches the unlocked dashboard', async ({ page }, testInfo) => {
    const username = uniqueUsername('login')
    await registerUser(page, username, PASSWORD)

    // Registration leaves the session active — log out, then back in to
    // exercise the real /login flow.
    await clickSidebarButton(page, testInfo, 'logout-button')
    await expect(page).toHaveURL(/\/login$/)

    await login(page, username, PASSWORD)

    await expect(page).toHaveURL(/\/dashboard$/)
    // The auto-created first entry persists, so /dashboard shows DashboardWelcome.
    await expect(page.getByText(`Welcome ${username}`)).toBeVisible()
  })

  test('unlocking the vault with the correct password restores access', async ({ page }, testInfo) => {
    const username = uniqueUsername('unlock')
    await registerUser(page, username, PASSWORD)

    // Log out and back in so the unlock goes through the authenticated
    // VaultUnlockDialog (reached via the header VaultIndicator after a manual
    // lock, not the /login form).
    await clickSidebarButton(page, testInfo, 'logout-button')
    await expect(page).toHaveURL(/\/login$/)
    await login(page, username, PASSWORD)

    // Login auto-unlocks, so lock manually to reach the unlock dialog.
    await clickSidebarButtonByName(page, testInfo, 'Lock vault')
    // The indicator flips to "Vault locked" — assert it before unlocking.
    await expect(page.locator('header').getByText('Vault locked', { exact: true })).toBeVisible()

    // Scope to <header> — the sidebar VaultLockButton exposes an identically
    // named button that would trip Playwright strict mode.
    await page.locator('header').getByRole('button', { name: 'Unlock vault', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.locator('#password-confirm').fill(PASSWORD)
    await page.getByTestId('vault-unlock-submit').click()

    // Correct password → unwrap succeeds → dialog closes (a wrong password
    // throws before close()). The indicator flips back to "unlocked".
    await expect(dialog).not.toBeVisible()
    await expect(page.locator('header').getByText('Vault unlocked', { exact: true })).toBeVisible()
  })

  test('unlocking the vault with a wrong password shows the vault error', async ({ page }, testInfo) => {
    const username = uniqueUsername('wrong')
    await registerUser(page, username, PASSWORD)

    // Log out and back in so the wrong-password attempt goes through the
    // authenticated vault-unlock path (login itself rejects at the Supabase
    // Auth step with a different login-page toast).
    await clickSidebarButton(page, testInfo, 'logout-button')
    await expect(page).toHaveURL(/\/login$/)
    await login(page, username, PASSWORD)

    // Login auto-unlocks, so lock manually to reach the unlock dialog.
    await clickSidebarButtonByName(page, testInfo, 'Lock vault')

    // Scope to <header> — the sidebar VaultLockButton exposes an identically
    // named button that would trip Playwright strict mode.
    await page.locator('header').getByRole('button', { name: 'Unlock vault', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.locator('#password-confirm').fill('DefinitelyNotThePassword!')
    await page.getByTestId('vault-unlock-submit').click()

    // Wrong password → unwrap fails → DecryptionError → mapped to
    // vault:errors.wrongPassword; dialog stays open for retry.
    await expect(dialog.getByText('Wrong password', { exact: true })).toBeVisible()
    await expect(dialog).toBeVisible()
  })

  test('logout from the sidebar redirects to login', async ({ page }, testInfo) => {
    const username = uniqueUsername('logout')
    await registerUser(page, username, PASSWORD)

    await clickSidebarButton(page, testInfo, 'logout-button')

    // logoutUser clears local auth state; the _authenticated guard redirects
    // to /login.
    await expect(page).toHaveURL(/\/login$/)
  })

  test('register with an already-taken username shows the availability error and disables submit', async ({ page }, testInfo) => {
    const username = uniqueUsername('taken')
    await registerUser(page, username, PASSWORD)

    // Log out so /register renders (the _public guard redirects authed users
    // to /dashboard).
    await clickSidebarButton(page, testInfo, 'logout-button')
    await expect(page).toHaveURL(/\/login$/)
    await page.goto('/register')

    // After the 1500ms debounce, check_username_availability returns false →
    // status flips to 'taken' → the message renders and submit disables.
    await page.locator('#username').fill(username)
    await expect(page.getByText('Username is already taken', { exact: true })).toBeVisible()
    await expect(page.getByTestId('register-submit')).toBeDisabled()
    await expect(page).toHaveURL(/\/register$/)
  })
})
