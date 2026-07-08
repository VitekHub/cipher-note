import { expect, type Locator, type Page, type TestInfo } from '@playwright/test'

/**
 * Viewport-aware navigation helpers for E2E specs.
 *
 * The app renders the sidebar differently depending on viewport:
 *   - Desktop (≥ md): sidebar is always visible inside `<aside>`.
 *   - Mobile (< md): sidebar is hidden; a hamburger button opens a Sheet
 *     (slide-out drawer) containing the same Sidebar component.
 *
 * These helpers abstract the difference so test code doesn't need
 * `if (isMobile)` branches for every navigation action.
 *
 * IMPORTANT: the desktop `<aside>` is always in the DOM (hidden via CSS
 * `display:none` on mobile), and the MobileNav bottom bar also renders
 * entry-nav-item / create-entry elements. Using `.first()` would pick the
 * hidden desktop element on mobile, so all sidebar interactions must be
 * scoped to the correct container via `sidebarLocator`.
 */

/** Returns true when running under a mobile-viewport Playwright project. */
export function isMobileProject(projectName: string): boolean {
  return projectName.startsWith('mobile-')
}

function isMobile(testInfo: TestInfo): boolean {
  return isMobileProject(testInfo.project.name)
}

/**
 * Creates an entry via the sidebar and returns the entryId from the URL.
 *
 * On mobile, opens the Sheet first then clicks the create button inside it.
 * On desktop, clicks the create button directly from the sidebar.
 * Pass `testInfo` for viewport-aware behavior; omit for desktop-only tests.
 *
 * Uses `expect.poll` to wait until the URL actually changes — if the user is
 * already viewing an entry, `toHaveURL(regex)` would resolve instantly and
 * capture the wrong id.
 */
export async function createEntry(page: Page, testInfo?: TestInfo): Promise<string> {
  const urlBefore = page.url()
  if (testInfo) {
    await clickSidebarButton(page, testInfo, 'create-entry')
  } else {
    // Desktop: the sidebar <aside> is always visible; .first() targets it.
    await page.getByTestId('create-entry').first().click()
  }
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

/**
 * Opens the sidebar navigation if the current viewport requires it.
 *
 * On mobile the sidebar lives inside a Sheet that starts closed. This helper
 * clicks the hamburger button and waits for the Sheet to animate in.
 * On desktop the sidebar is always visible, so this is a no-op.
 */
export async function openSidebar(page: Page, testInfo: TestInfo): Promise<void> {
  if (!isMobile(testInfo)) return

  await page.getByRole('button', { name: 'Menu', exact: true }).click()
  // Wait for the Sheet dialog to appear and the entry list to render.
  await expect(page.getByRole('dialog').getByTestId('entry-nav-item').first()).toBeVisible()
}

/**
 * Returns a Locator scoped to the sidebar container.
 *
 * On mobile this scopes to the Sheet dialog (only present when open).
 * On desktop this scopes to the `<aside>` element (always present).
 * Use this for sidebar interactions that don't have a dedicated helper.
 */
export function sidebarLocator(page: Page, testInfo: TestInfo): Locator {
  return isMobile(testInfo) ? page.getByRole('dialog') : page.locator('aside')
}

/**
 * Opens the sidebar (mobile Sheet) if needed and returns a Locator scoped to
 * the sidebar container. On desktop, simply returns the `<aside>` locator.
 *
 * Use this for sidebar assertions. For common sidebar actions, prefer
 * the dedicated helpers (clickEntryNav, clickSidebarButton, etc.).
 */
export async function getSidebar(page: Page, testInfo: TestInfo): Promise<Locator> {
  await openSidebar(page, testInfo)
  return sidebarLocator(page, testInfo)
}

/**
 * Returns a Locator for a specific entry nav item in the sidebar.
 *
 * Opens the sidebar Sheet on mobile first, then scopes to the correct
 * container. Use for assertions on a specific entry's sidebar row.
 * To click a nav item, prefer `clickEntryNav`.
 */
export async function entryNavLocator(page: Page, testInfo: TestInfo, entryId: string): Promise<Locator> {
  const sidebar = await getSidebar(page, testInfo)
  return sidebar.locator(`[data-testid="entry-nav-item"][data-entry-id="${entryId}"]`)
}

/**
 * Clicks an entry nav item, handling the mobile Sheet.
 *
 * On mobile, opens the Sheet first so the entry list is in the DOM,
 * then clicks the target entry. The Sheet closes on navigation.
 * On desktop, just clicks the entry nav item directly.
 */
export async function clickEntryNav(page: Page, entryId: string, testInfo: TestInfo): Promise<void> {
  const navItem = await entryNavLocator(page, testInfo, entryId)
  await navItem.click()
}

/**
 * Clicks the first entry in the sidebar, handling the mobile Sheet.
 *
 * Use when the entry ID is not known (e.g. the auto-created entry after
 * registration). When the ID is known, prefer `clickEntryNav` instead.
 */
export async function clickFirstEntry(page: Page, testInfo: TestInfo): Promise<void> {
  const sidebar = await getSidebar(page, testInfo)
  await sidebar.getByTestId('entry-nav-item').first().click()
}

/**
 * Clicks a sidebar button, handling the mobile Sheet.
 *
 * On mobile, opens the Sheet first, then clicks the button inside it.
 * On desktop, clicks the button directly from the sidebar.
 */
export async function clickSidebarButton(
  page: Page,
  testInfo: TestInfo,
  testId: string,
): Promise<void> {
  const sidebar = await getSidebar(page, testInfo)
  await sidebar.getByTestId(testId).click()
}

/**
 * Clicks a sidebar button by accessible name, handling the mobile Sheet.
 *
 * On mobile, opens the Sheet first, then clicks the button inside it.
 * On desktop, clicks the button directly from the sidebar.
 */
export async function clickSidebarButtonByName(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  const sidebar = await getSidebar(page, testInfo)
  await sidebar.getByRole('button', { name, exact: true }).click()
}

/**
 * Navigates to Settings, handling the mobile Sheet.
 *
 * On mobile, opens the Sheet first, then clicks the Settings link.
 * On desktop, clicks the Settings link directly from the sidebar.
 */
export async function navigateToSettings(page: Page, testInfo: TestInfo): Promise<void> {
  const sidebar = await getSidebar(page, testInfo)
  await sidebar.getByTestId('nav-settings').click()
}

/** Captures the entryId from the current /dashboard/$entryId URL. */
export function entryIdFromUrl(page: Page): string {
  const match = page.url().match(/\/dashboard\/([^/]+)$/)
  if (!match) throw new Error(`expected entry id in URL, got ${page.url()}`)
  return match[1]
}
