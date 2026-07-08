import { expect, type Page } from '@playwright/test'

/**
 * Navigation helpers for E2E specs — entry creation and URL parsing.
 *
 * `createEntry` uses `expect.poll` to guard against the race where the user
 * is already on `/dashboard/$entryId` and a click to create a new entry must
 * wait for the URL to actually change before reading the new entry id.
 */

/** Captures the entryId from the current /dashboard/$entryId URL. */
export function entryIdFromUrl(page: Page): string {
  const match = page.url().match(/\/dashboard\/([^/]+)$/)
  if (!match) throw new Error(`expected entry id in URL, got ${page.url()}`)
  return match[1]
}

/**
 * Drives the sidebar "New note" button to create an entry and returns the
 * entryId from the URL so later reload/login steps can re-navigate to it.
 *
 * Uses `expect.poll` to wait until the URL actually changes — if the user is
 * already viewing an entry, `toHaveURL(regex)` would resolve instantly and
 * capture the wrong id.
 */
export async function createEntry(page: Page): Promise<string> {
  // `create-entry` renders on both the desktop sidebar and the md:hidden
  // mobile nav; .first() targets the sidebar variant.
  const urlBefore = page.url()
  await page.getByTestId('create-entry').first().click()
  await expect
    .poll(
      () => {
        const url = page.url()
        return /\/dashboard\/[^/]+$/.test(url) && url !== urlBefore ? url : null
      },
      { timeout: 10_000 },
    )
    .not.toBeNull()
  return entryIdFromUrl(page)
}
