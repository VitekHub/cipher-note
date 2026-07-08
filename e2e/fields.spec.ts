import { expect, test, type Page } from '@playwright/test'

import { resetUserData } from './helpers/db'
import { login, registerUser, uniqueUsername } from './helpers/users'

/**
 * Entry / field CRUD E2E — real crypto against the production preview build.
 *
 * Each test registers a fresh user (seed users carry placeholder key material
 * that cannot be unwrapped), creates an entry through the real UI, types into
 * all four encrypted fields, and asserts the auto-save indicator reaches
 * "Saved" per field. Persistence is verified across a same-session reload
 * (vault locks on reload, so it must be re-unlocked) and a full logout → login.
 * Real Argon2id runs in the worker on every auth op. `beforeEach` truncates
 * `auth.users` + `private.rate_limits` so no pre-auth RPC trips the limiter.
 */

const PASSWORD = 'TestPass123!'

const FIELD_VALUES = {
  title: 'My secret note title',
  website: 'https://example.com',
  email: 'vault@example.com',
  note: 'Multi-line\nencrypted note body.',
} as const

type FieldValues = Record<(typeof FIELD_NAMES)[number], string>

const FIELD_NAMES = ['title', 'website', 'email', 'note'] as const

test.describe('fields', () => {
  test.beforeEach(async () => {
    await resetUserData()
  })

  /** Captures the entryId from the current /dashboard/$entryId URL. */
  function entryIdFromUrl(page: Page): string {
    const match = page.url().match(/\/dashboard\/([^/]+)$/)
    if (!match) throw new Error(`expected entry id in URL, got ${page.url()}`)
    return match[1]
  }

  /**
   * Drives the sidebar "New note" button to create an entry and returns the
   * entryId from the URL so later reload/login steps can re-navigate to it.
   */
  async function createEntry(page: Page): Promise<string> {
    // .first() targets the desktop sidebar variant (mobile nav is hidden).
    const urlBefore = page.url()
    await page.getByTestId('create-entry').first().click()
    // If already viewing an entry, toHaveURL(regex) would resolve instantly and
    // capture the wrong id — poll until the URL actually changes.
    await expect
      .poll(
        () => {
          const url = page.url()
          return /\/dashboard\/[^/]+$/.test(url) && url !== urlBefore ? url : null
        },
        { timeout: 10000 },
      )
      .not.toBeNull()
    return entryIdFromUrl(page)
  }

  /**
   * Fills all four field inputs and asserts each SaveIndicator reaches "Saved".
   * Auto-save debounces 1s after the last keystroke, then transitions
   * DIRTY → SAVING → SAVED; `toHaveText('Saved')` auto-retries through SAVING
   * until the save round-trip completes.
   */
  async function fillAllFieldsAndAwaitSaved(page: Page, values: FieldValues = FIELD_VALUES): Promise<void> {
    for (const fieldName of FIELD_NAMES) {
      await page.getByTestId(`field-input-${fieldName}`).fill(values[fieldName])
    }
    for (const fieldName of FIELD_NAMES) {
      const card = page.getByTestId(`field-card-${fieldName}`)
      await expect(card.getByTestId('save-indicator')).toHaveText('Saved')
    }
  }

  /**
   * Unlocks the vault from the locked dashboard state (after a reload drops
   * the in-memory master key). Clicks the LockedVaultCard "Unlock vault"
   * button, submits the password, and waits for the dialog to close.
   */
  async function unlockVault(page: Page, password: string): Promise<void> {
    // Scope to <main>: the header and sidebar also expose an "Unlock vault"
    // button that would trip Playwright strict mode. LockedVaultCard renders
    // the one in main content.
    await page.getByRole('main').getByRole('button', { name: 'Unlock vault', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.locator('#password-confirm').fill(password)
    await page.getByTestId('vault-unlock-submit').click()
    await expect(dialog).not.toBeVisible()
  }

  /** Asserts every field input re-decrypted to the originally typed value. */
  async function expectFieldsRestored(page: Page, values: FieldValues = FIELD_VALUES): Promise<void> {
    for (const fieldName of FIELD_NAMES) {
      await expect(page.getByTestId(`field-input-${fieldName}`)).toHaveValue(values[fieldName])
    }
  }

  test('typing into all four fields auto-saves and persists across reload + re-unlock', async ({ page }) => {
    const username = uniqueUsername('fields')
    await registerUser(page, username, PASSWORD)

    const entryId = await createEntry(page)
    await fillAllFieldsAndAwaitSaved(page)

    // Reload drops the in-memory master key → vault locks → LockedVaultCard.
    // Re-unlock and confirm the server ciphertext re-decrypts to the values
    // typed before the reload.
    await page.reload()
    await unlockVault(page, PASSWORD)
    await expect(page).toHaveURL(new RegExp(`/dashboard/${entryId}$`))
    await expectFieldsRestored(page)
  })

  test('saved values re-decrypt after logout and a fresh login', async ({ page }) => {
    const username = uniqueUsername('relogin')
    await registerUser(page, username, PASSWORD)

    const entryId = await createEntry(page)
    await fillAllFieldsAndAwaitSaved(page)

    // Logout clears local auth + key state; login re-derives the passwordKey
    // and auto-unlocks, so navigating back to the entry decrypts the persisted
    // ciphertext without a separate unlock. Reach it via its sidebar nav item
    // (in-app) so the vault stays unlocked.
    await page.getByTestId('logout-button').click()
    await expect(page).toHaveURL(/\/login$/)

    await login(page, username, PASSWORD)
    await page.locator(`[data-testid="entry-nav-item"][data-entry-id="${entryId}"]`).first().click()
    await expect(page).toHaveURL(new RegExp(`/dashboard/${entryId}$`))
    await expectFieldsRestored(page)
  })

  test('deleting the last entry returns to the empty dashboard', async ({ page }) => {
    const username = uniqueUsername('delete')
    await registerUser(page, username, PASSWORD)

    // Registration auto-creates one entry. Open it, then delete it — with zero
    // entries remaining, /dashboard renders EmptyState (not DashboardWelcome).
    // `entry-nav-item` renders on both desktop sidebar and md:hidden mobile
    // nav; .first() targets the sidebar variant.
    await page.getByTestId('entry-nav-item').first().click()
    await expect(page).toHaveURL(/\/dashboard\/[^/]+$/)

    await page.getByTestId('delete-entry').click()
    // DeleteEntryDialog uses base-ui AlertDialog → role="alertdialog".
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await page.getByTestId('delete-entry-confirm').click()

    await expect(page).toHaveURL(/\/dashboard$/)
    // EmptyState renders the "Create your first note" button (testid
    // `create-entry-empty`), unique to the empty dashboard — the sidebar's
    // "No notes yet" label also shows, so the create button is the
    // unambiguous EmptyState signal.
    await expect(page.getByTestId('create-entry-empty')).toBeVisible()
  })

  test('multiple entries keep per-entry decrypted content when switching via the sidebar', async ({ page }) => {
    const username = uniqueUsername('multi')
    await registerUser(page, username, PASSWORD)

    // Entry 1 (auto-created): open via sidebar, type distinct values.
    await page.getByTestId('entry-nav-item').first().click()
    await expect(page).toHaveURL(/\/dashboard\/[^/]+$/)
    const entry1Id = entryIdFromUrl(page)
    const entry1Values: FieldValues = {
      title: 'Entry one title',
      website: 'https://one.example.com',
      email: 'one@example.com',
      note: 'Note body ONE',
    }
    await fillAllFieldsAndAwaitSaved(page, entry1Values)

    // Entry 2: create via the sidebar "New note" button, type different values.
    const entry2Id = await createEntry(page)
    const entry2Values: FieldValues = {
      title: 'Entry two title',
      website: 'https://two.example.com',
      email: 'two@example.com',
      note: 'Note body TWO',
    }
    await fillAllFieldsAndAwaitSaved(page, entry2Values)

    // Switch back to entry 1 via its sidebar nav item. Each entry's fields are
    // keyed by entryId in the query cache, so switching routes must re-decrypt
    // entry 1's ciphertext — not surface entry 2's. .first() scopes to the
    // sidebar variant (entry-nav-item also renders in the mobile nav).
    await page.locator(`[data-testid="entry-nav-item"][data-entry-id="${entry1Id}"]`).first().click()
    await expect(page).toHaveURL(new RegExp(`/dashboard/${entry1Id}$`))
    await expectFieldsRestored(page, entry1Values)

    // Switch to entry 2; assert its (different) values are the ones restored.
    await page.locator(`[data-testid="entry-nav-item"][data-entry-id="${entry2Id}"]`).first().click()
    await expect(page).toHaveURL(new RegExp(`/dashboard/${entry2Id}$`))
    await expectFieldsRestored(page, entry2Values)
  })

  test('editing the title field updates the sidebar nav item label', async ({ page }) => {
    const username = uniqueUsername('title')
    await registerUser(page, username, PASSWORD)

    // Open the auto-created entry; its sidebar item initially shows the i18n
    // fallback "Note 1" because the title field is empty (EntryNavItem falls
    // back to entryLabel when the decrypted title is empty).
    await page.getByTestId('entry-nav-item').first().click()
    await expect(page).toHaveURL(/\/dashboard\/[^/]+$/)
    const entryId = entryIdFromUrl(page)
    const navItem = page.locator(`[data-testid="entry-nav-item"][data-entry-id="${entryId}"]`).first()
    await expect(navItem).toContainText('Note 1')

    // Type a title and let auto-save round-trip. useSaveField optimistically
    // writes the plaintext into the field.detail cache onMutate, so
    // EntryNavItem's useField(entryId, 'title') subscription re-renders with
    // the new label once the debounced save fires — no reload needed.
    const title = 'My sidebar title'
    await page.getByTestId('field-input-title').fill(title)
    await expect(page.getByTestId('field-card-title').getByTestId('save-indicator')).toHaveText('Saved')

    await expect(navItem).toContainText(title)
    // The fallback label is gone — the title replaced it, not appended to it.
    await expect(navItem).not.toContainText('Note 1')
  })
})
