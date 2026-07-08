import { readFileSync } from 'node:fs'
import path from 'node:path'
import { defineConfig, devices } from '@playwright/test'

/**
 * Loads `.env.local` into `process.env` so Node-side test code (global setup,
 * DB helpers, DB assertions) can read VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
 * Vite loads this file itself for the app build; Playwright does not, so we do
 * it here once. Values already set in the real environment win.
 */
function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  try {
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, '')
      if (!(key in process.env)) process.env[key] = value
    }
  } catch {
    // No .env.local — rely on real environment variables.
  }
}

loadEnvLocal()

const baseURL = 'http://localhost:4173'
const supabaseUrl = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'

export default defineConfig({
  testDir: './e2e',
  testMatch: '*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',

  use: {
    baseURL,
    locale: 'en-US',
    trace: 'on-first-retry',
    // Real Argon2id derivations happen per auth op; don't let a slow worker trip actions.
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  webServer: {
    command: 'pnpm build && pnpm exec vite preview --port 4173 --strictPort',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      // Forward to the build so the production bundle talks to the same Supabase.
      VITE_SUPABASE_URL: supabaseUrl,
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ?? '',
    },
  },
})
