import { randomBytes } from 'node:crypto'

import { expect, type Page } from '@playwright/test'

/**
 * UI-driving helpers for E2E specs. Each helper drives the real production
 * flow through the rendered DOM (no API shortcuts) so Argon2id actually runs
 * in the worker and the full crypto path is exercised end-to-end.
 *
 * Selectors target stable attributes (input ids, dialog roles, English i18n
 * button labels, and data-testids).
 */

export interface RegisteredUser {
  username: string
  password: string
  mnemonic: string
}

/** DB CHECK constraint is `^[a-zA-Z0-9_]{3,32}$`. */
const USERNAME_MAX = 32

let counter = 0

/**
 * Returns a unique username that fits `^[a-zA-Z0-9_]{3,32}$`, won't collide
 * with seed users (`testuser`/`alice`), and is unique across specs in a run.
 * The prefix is stripped of any character the DB CHECK rejects (anything
 * outside [a-zA-Z0-9_]) so callers can pass labels like `rt-edit`.
 */
export function uniqueUsername(prefix: string): string {
  counter += 1
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_]/g, '')
  const suffix = randomBytes(3).toString('hex')
  return `e2e_${safePrefix}_${suffix}${counter}`.slice(0, USERNAME_MAX)
}

/**
 * Loads the SPA from a fresh context. The single `page.goto` in the suite:
 * Playwright starts each test at `about:blank`, so the app must be loaded once
 * before any in-app navigation. Lands on `/` (LandingPage) when unauthenticated;
 * every subsequent navigation is an in-app click so KeyVault and the crypto
 * store survive across routes.
 */
export async function loadApp(page: Page): Promise<void> {
  await page.goto('/')
}

/**
 * Registers a fresh user through the real `/register` flow and captures the
 * 12-word mnemonic shown in MnemonicDialog. Returns the credentials plus the
 * mnemonic so recovery/crypto specs can reuse them. Leaves the page on
 * `/dashboard`.
 */
export async function registerUser(page: Page, username: string, password: string): Promise<RegisteredUser> {
  // Bootstrap the SPA, then navigate to /register via the landing hero CTA
  // link (in-app, no full reload). CtaButtons renders in both HeroSection and
  // SecurityBanner, so .first() targets the hero instance.
  await loadApp(page)
  await page.getByTestId('landing-cta-register').first().click()
  await page.waitForURL('**/register')

  await page.locator('#username').fill(username)
  await page.locator('#password').fill(password)
  await page.locator('#confirm-password').fill(password)

  // Click auto-waits for the button to be enabled — the username-availability
  // check must resolve to "available" first (disabled while "checking"/"taken").
  await page.locator('button[type="submit"]').click()

  // Registration runs a real Argon2id derivation (~1s) before the dialog opens.
  const dialog = page.getByRole('dialog')
  await dialog.waitFor({ state: 'visible' })

  const mnemonic = await readMnemonic(dialog)

  // Acknowledge + Continue → navigates to /dashboard. base-ui's Checkbox routes
  // `id` to a visually-hidden native <input> at position:fixed top-left, so
  // `#id` clicks under the dialog overlay. Target the visible
  // <span role="checkbox" data-testid="..."> by testid instead.
  await dialog.getByTestId('mnemonic-acknowledge').check()
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.waitForURL('**/dashboard')

  return { username, password, mnemonic }
}

/** Logs in through the real `/login` flow. */
export async function login(page: Page, username: string, password: string): Promise<void> {
  await page.goto('/login')

  await page.locator('#username').fill(username)
  await page.locator('#password').fill(password)
  await page.locator('button[type="submit"]').click()

  // Real Argon2id derivation + envelope unwrap.
  await page.waitForURL('**/dashboard')
}

/**
 * Reads the 12-word mnemonic from MnemonicDialog, stripping the "N." index
 * prefix each word cell renders. Targets the word cells' `font-mono` class
 * (the only such elements in the dialog).
 */
async function readMnemonic(dialog: ReturnType<Page['getByRole']>): Promise<string> {
  const wordCells = dialog.locator('.font-mono')
  await expect(wordCells).toHaveCount(12)
  const texts = await wordCells.allInnerTexts()
  return texts.map((text) => text.replace(/^\s*\d+\.\s*/, '').trim()).join(' ')
}
