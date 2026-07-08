import { expect, test, type Page } from '@playwright/test'

import { resetUserData } from './helpers/db'
import { login, registerUser, uniqueUsername } from './helpers/users'

/**
 * Crypto-flow E2E — real Argon2id against the production preview build.
 *
 * Covers the four flows docs/e2ee-plan.md groups under `crypto.spec.ts`:
 * change password, verify + regenerate seed phrase, account recovery, and
 * single-field key rotation. Each test registers a fresh user (seed users
 * carry placeholder key material that cannot be unwrapped) and drives the real
 * UI, so each auth op runs a real Argon2id derivation (~1s) and the full key
 * hierarchy is exercised end-to-end. `beforeEach` truncates `auth.users` +
 * `private.rate_limits` so no pre-auth RPC trips the shared-IP limiter.
 */

const PASSWORD = 'TestPass123!'
const NEW_PASSWORD = 'NewPass456!'

const NOTE_VALUE = 'Rotatable note body — must survive key rotation.'

/**
 * Reads the 12-word mnemonic from the `[data-testid="mnemonic-words"]` grid,
 * stripping the "N." index prefix each cell renders. Used to compare the
 * regenerated mnemonic against the one captured at registration.
 */
async function readMnemonicFromDialog(page: Page): Promise<string> {
  const grid = page.getByTestId('mnemonic-words')
  await expect(grid).toBeVisible()
  const cells = grid.locator('.font-mono')
  await expect(cells).toHaveCount(12)
  const texts = await cells.allInnerTexts()
  return texts.map((text) => text.replace(/^\s*\d+\.\s*/, '').trim()).join(' ')
}

/**
 * Fills the 12 MnemonicInput word cells one at a time. Per-word `fill` (not
 * paste) lets each cell's blur validation run against the BIP-39 wordlist;
 * real words pass, so `isValid` flips true and submit enables.
 */
async function fillMnemonicInputs(page: Page, mnemonic: string): Promise<void> {
  const words = mnemonic.split(' ').filter(Boolean)
  for (let i = 0; i < words.length; i++) {
    await page.getByTestId(`mnemonic-word-${i + 1}`).fill(words[i])
  }
}

/**
 * Drives the sidebar "New note" button to create an entry and returns the
 * entryId from the URL so the rotation test can re-navigate after rotating.
 */
async function createEntry(page: Page): Promise<string> {
  // `create-entry` renders on both the desktop sidebar and the md:hidden
  // mobile nav; .first() targets the sidebar variant.
  await page.getByTestId('create-entry').first().click()
  await expect(page).toHaveURL(/\/dashboard\/[^/]+$/)
  const match = page.url().match(/\/dashboard\/([^/]+)$/)
  if (!match) throw new Error(`expected entry id in URL, got ${page.url()}`)
  return match[1]
}

test.describe('crypto', () => {
  test.beforeEach(async () => {
    await resetUserData()
  })

  test('change password: old password fails, new password unlocks the vault', async ({ page }) => {
    const username = uniqueUsername('changepw')
    await registerUser(page, username, PASSWORD)

    // Settings → Change password. The dialog re-derives the passwordKey
    // (Argon2id), re-wraps the master key, uploads the new envelope, and updates
    // Supabase Auth — all before the success toast. Navigate in-app so the
    // unlocked vault survives.
    await page.getByTestId('nav-settings').first().click()
    await page.waitForURL('**/settings')
    await page.getByTestId('settings-change-password').click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.locator('#current-password').fill(PASSWORD)
    await dialog.locator('#new-password').fill(NEW_PASSWORD)
    await dialog.locator('#confirm-password').fill(NEW_PASSWORD)
    await page.getByTestId('change-password-submit').click()

    await expect(page.getByText('Password changed successfully', { exact: true })).toBeVisible()
    await expect(dialog).not.toBeVisible()

    // Logout clears the local session + key state.
    await page.getByTestId('logout-button').click()
    await expect(page).toHaveURL(/\/login$/)

    // The old authHash no longer matches Supabase Auth, so login rejects and
    // stays on /login with the invalid-credentials toast.
    await page.locator('#username').fill(username)
    await page.locator('#password').fill(PASSWORD)
    await page.getByTestId('login-submit').click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByText('Invalid username or password', { exact: true })).toBeVisible()

    // The new password derives the matching authHash and unlocks the vault.
    await login(page, username, NEW_PASSWORD)
    await expect(page).toHaveURL(/\/dashboard$/)
    // The auto-created first entry survives, so DashboardWelcome shows.
    await expect(page.getByText(`Welcome ${username}`)).toBeVisible()
  })

  test('change password: wrong current password shows an error and leaves the session intact', async ({ page }) => {
    const username = uniqueUsername('changepwbad')
    await registerUser(page, username, PASSWORD)

    // Settings → Change password dialog (in-app nav keeps the vault unlocked).
    await page.getByTestId('nav-settings').first().click()
    await page.waitForURL('**/settings')
    await page.getByTestId('settings-change-password').click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Valid new/confirm pair, wrong current password. The schema passes so
    // changeUserPassword runs; rewrapMasterKey's unwrap throws DecryptionError
    // in Step 1 — before the DB upload or Auth update. No server state mutates.
    await dialog.locator('#current-password').fill('WrongCurrentPass!')
    await dialog.locator('#new-password').fill(NEW_PASSWORD)
    await dialog.locator('#confirm-password').fill(NEW_PASSWORD)
    await page.getByTestId('change-password-submit').click()

    // DecryptionError → wrongCurrentPassword toast. Error path skips
    // reset()/close(), so the dialog stays open.
    await expect(page.getByText('Current password is incorrect', { exact: true })).toBeVisible()
    await expect(dialog).toBeVisible()
    await expect(page).toHaveURL(/\/settings$/)

    // Session intact: dismiss the dialog and open the first entry. The field
    // editor renders only while unlocked (locked shows LockedVaultCard), so
    // field-input-note visible proves the keys survived.
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
    await page.getByTestId('entry-nav-item').first().click()
    await expect(page).toHaveURL(/\/dashboard\/[^/]+$/)
    await expect(page.getByTestId('field-input-note')).toBeVisible()
  })

  test('verify seed phrase confirms the stored mnemonic, regenerate produces a new one', async ({ page }) => {
    const username = uniqueUsername('mnemonic')
    const { mnemonic } = await registerUser(page, username, PASSWORD)

    // Verify Seed Phrase: paste the registration mnemonic into the 12 cells
    // and submit. verifyMnemonic unwraps the stored recovery data with it — a
    // match shows a success toast. Navigate in-app so the vault stays unlocked.
    await page.getByTestId('nav-settings').first().click()
    await page.waitForURL('**/settings')
    await page.getByTestId('settings-verify-mnemonic').click()
    const verifyDialog = page.getByRole('dialog')
    await expect(verifyDialog).toBeVisible()
    await fillMnemonicInputs(page, mnemonic)
    await page.getByTestId('verify-mnemonic-submit').click()
    await expect(page.getByText('Your recovery phrase is valid', { exact: true })).toBeVisible()
    await expect(verifyDialog).not.toBeVisible()

    // Regenerate: confirm with the current password (Argon2id + master-key
    // unwrap), then a fresh mnemonic is generated, saved as the new recovery
    // data, and shown in MnemonicDialog. It must differ from the registration
    // mnemonic (collision probability is negligible).
    await page.getByTestId('settings-regenerate-mnemonic').click()
    const pwDialog = page.getByRole('dialog')
    await expect(pwDialog).toBeVisible()
    await pwDialog.locator('#password-confirm').fill(PASSWORD)
    await page.getByTestId('regenerate-mnemonic-submit').click()

    // PasswordConfirmDialog hands off to MnemonicDialog (same role); read the
    // new mnemonic from the mnemonic-words grid.
    const newMnemonic = await readMnemonicFromDialog(page)
    expect(newMnemonic.split(' ').filter(Boolean)).toHaveLength(12)
    expect(newMnemonic).not.toEqual(mnemonic)

    // Acknowledge + Continue closes the dialog with a success toast.
    await page.getByTestId('mnemonic-acknowledge').check()
    await page.getByTestId('mnemonic-continue').click()
    await expect(page.getByText('Seed phrase regenerated successfully', { exact: true })).toBeVisible()
  })

  test('account recovery: mnemonic + new password restores access', async ({ page }) => {
    const username = uniqueUsername('recover')
    const { mnemonic } = await registerUser(page, username, PASSWORD)

    // /recover is public; log out first so the _authenticated guard doesn't
    // redirect back to /dashboard. Reach it via the login "Forgot password?"
    // link (in-app navigation).
    await page.getByTestId('logout-button').click()
    await expect(page).toHaveURL(/\/login$/)

    await page.getByRole('link', { name: 'Forgot password?' }).click()
    await page.waitForURL('**/recover')

    // Step 1 — username + mnemonic. validateMnemonic fetches the pre-auth
    // recovery data and unwraps the master key with the mnemonic.
    await page.locator('#username').fill(username)
    await fillMnemonicInputs(page, mnemonic)
    await page.getByTestId('recover-submit').click()

    // Step 1 → Step 2 is in-place (URL stays /recover); wait for the
    // new-password form before filling.
    await expect(page.locator('#new-password')).toBeVisible()
    await page.locator('#new-password').fill(NEW_PASSWORD)
    await page.locator('#confirm-new-password').fill(NEW_PASSWORD)
    await page.getByTestId('recover-set-password').click()

    // recover_account atomically rewrites auth + salts + the master-key
    // envelope, then auto-logs in. Happy path lands on /dashboard;
    // RecoveryLoginError falls back to /login with a success toast. Either way
    // the new password works — wait for either URL, then drive an explicit
    // login to prove it unlocks the vault.
    await expect(page).toHaveURL(/\/(dashboard|login)$/)
    if (page.url().endsWith('/dashboard')) {
      await page.getByTestId('logout-button').click()
      await expect(page).toHaveURL(/\/login$/)
    }

    await login(page, username, NEW_PASSWORD)
    await expect(page).toHaveURL(/\/dashboard$/)
    // Recovery preserves the auto-created first entry, so DashboardWelcome
    // shows.
    await expect(page.getByText(`Welcome ${username}`)).toBeVisible()
  })

  test('rotating a single field key increments the version and preserved content still decrypts', async ({ page }) => {
    const username = uniqueUsername('rotate')
    await registerUser(page, username, PASSWORD)

    // Create an entry and type a note so there is real ciphertext to re-encrypt.
    const entryId = await createEntry(page)
    await page.getByTestId('field-input-note').fill(NOTE_VALUE)
    const noteCard = page.getByTestId('field-card-note')
    await expect(noteCard.getByTestId('save-indicator')).toHaveText('Saved')

    // Settings → Key versions. The note row reports its current wrapped-key
    // version via a `font-mono` "vN" span. Navigate in-app so the vault stays
    // unlocked. Expand the key management collapsible first — it starts collapsed.
    await page.getByTestId('nav-settings').first().click()
    await page.waitForURL('**/settings')
    await page.getByTestId('settings-key-management-trigger').click()
    const noteRow = page.getByTestId('settings-rotate-key-note').locator('xpath=ancestor::div[1]')
    const noteVersion = noteRow.locator('.font-mono')
    await expect(noteVersion).toHaveText('v1')

    // Rotate just the note key. rotateFieldKey re-encrypts every entry's note
    // ciphertext, atomically swaps the wrapped key server-side, then stores the
    // v2 key in the vault + updates the cached envelope the version label reads.
    await page.getByTestId('settings-rotate-key-note').click()
    // RotateFieldKeyDialog is a Base UI AlertDialog, so role is `alertdialog`,
    // not `dialog` like the other settings dialogs.
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await page.getByTestId('rotate-field-key-confirm').click()

    await expect(page.getByText('Note key rotated to v2', { exact: true })).toBeVisible()
    await expect(dialog).not.toBeVisible()
    await expect(noteVersion).toHaveText('v2')

    // Navigate back to the entry via the sidebar (in-app, no reload). The
    // field query was invalidated, so the note refetches and re-decrypts with
    // the v2 key now in the vault — the plaintext must survive intact.
    await page.locator(`[data-testid="entry-nav-item"][data-entry-id="${entryId}"]`).first().click()
    await expect(page).toHaveURL(new RegExp(`/dashboard/${entryId}$`))
    await expect(page.getByTestId('field-input-note')).toHaveValue(NOTE_VALUE)
  })
})
