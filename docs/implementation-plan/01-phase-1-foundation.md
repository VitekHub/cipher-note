# Phase 1: Project Foundation ✅

## Step 1 — Project Scaffolding + UI Foundation ✅

**Goal:** Working Vite + React app with Tailwind, shadcn/ui, and dark mode.

**Code:**
- `pnpm create vite` with React + TypeScript template
- Install and configure Tailwind CSS v4
- Initialize shadcn/ui (components.json, dark theme default, CSS variables)
- Install base shadcn components: `Button`, `Input`, `Label`, `Card`, `Dialog`, `Sonner`
- Set up `src/shared/ui/` as the component library location — **each shadcn component in its own file, NO `index.ts` barrel file** (import directly: `import { Button } from '@/shared/ui/button'`)
- Configure dark mode as default via `class="dark"` on `<html>` and ThemeProvider context
- Create `src/app/styles/globals.css` with Tailwind v4 directives (`@import "tailwindcss"`, `@custom-variant dark`, `@theme inline`) + shadcn CSS variables
- Create `ThemeProvider` component in `src/shared/lib/theme-provider.tsx` (defaults to dark, persists to localStorage)
- Create base `AppLayout` component with dark theme
- Configure Vite code splitting: `argon2-browser` → `crypto-argon2` chunk, `@scure/bip39` → `crypto-bip39` chunk via `manualChunks`. **Note:** `argon2-browser` must be imported as `argon2-browser/dist/argon2-bundled.min.js` — the default import loads a `.wasm` file which Vite cannot handle. The bundled build embeds WASM as base64 in JS. Add a module declaration in `src/env.d.ts` mapping the bundled path to `argon2-browser` types.
- Set up ESLint with `eslint-config-prettier` to disable conflicting formatting rules; configure `react-refresh/only-export-components` rule to allow constant exports (`allowConstantExport: true`), named exports for `useTheme` and `buttonVariants` (`allowExportNames`), and disable the rule for `src/test/**` files
- Set up Prettier with `prettier-plugin-tailwindcss` for deterministic class sorting, single quotes, trailing commas, no semicolons

**Tests:**
- Verify `render(<App />)` shows the app with dark background
- Verify shadcn `Button` renders correctly

---

## Step 2 — i18n Setup ✅

**Goal:** react-i18next working with English (default) and Czech, namespace lazy loading.

**Code:**
- Install `react-i18next`, `i18next`, `i18next-browser-languagedetector`, `i18next-resources-to-backend` (instead of `i18next-http-backend` — `resources-to-backend` uses dynamic `import()` for Vite-native code splitting, keeping locale files in `src/` rather than `public/`)
- Create `src/shared/i18n/config.ts` — i18next init with `i18next-resources-to-backend` for lazy namespace loading via dynamic `import()`, language detector (localStorage + navigator), fallback to `en`
- Create `src/shared/i18n/locales/en/` and `src/shared/i18n/locales/cs/` directories
- Create namespace JSON files:
  - `common.json` — shared strings (buttons, labels, errors)
  - `auth.json` — login, register, recovery strings
  - `fields.json` — note, website, email field labels
  - `settings.json` — settings page strings
  - `crypto.json` — key management, security strings
- Wire i18n into app: import config in `src/main.tsx`, add `<Suspense>` boundary, update `src/App.tsx` to use `useTranslation()`
- Update `src/test/utils.tsx` — add `<Suspense>` to test wrapper
- Add language switcher component in `src/shared/ui/nav/LanguageSwitcher.tsx` (toggles between EN/CS, persists to localStorage via i18next-browser-languagedetector)
- No `useTranslation` wrapper hook — use `useTranslation` from `react-i18next` directly

**Tests:**
- Verify default language is `en`
- Verify switching to `cs` renders Czech strings
- Verify namespace lazy loading (separate chunks per namespace per language in build output)
- Verify fallback to `en` for missing `cs` keys
- App renders with i18n-translated strings and LanguageSwitcher

---

## Step 3 — Router + Route Structure + Suspense Boundaries ✅

**Goal:** TanStack Router configured with all app routes, layouts, and Suspense boundaries.

**Code:**
- Install `@tanstack/react-router`
- Create route tree:
  - `/` — redirect to `/dashboard` or `/login`
  - `/login` — public, auth page
  - `/register` — public, auth page
  - `/recover` — public, seed phrase recovery
  - `/dashboard` — protected, main app
  - `/settings` — protected, settings page
- Create `src/app/routes/` with route files
- Create `PublicLayout` component (centered card, no sidebar)
- Create `ProtectedLayout` component (sidebar + header + main content)
- Create `src/app/router.tsx` with route tree and type-safe routes
- Set up `RouterProvider` in `src/app/Providers.tsx`
- **Add Suspense boundaries at every route level** in the route tree. Each route wraps its component in `<Suspense fallback={<PageSkeleton />}>` so that:
  - Lazy-loaded route chunks show a skeleton while loading
  - Async data fetching (field decryption, key unwrapping) shows appropriate loading states
  - Crypto operations (Argon2id derivation) never leave the user staring at a blank screen
- Create `src/app/ErrorBoundary.tsx` — root error boundary that catches rendering errors and crypto-specific errors (decryption failure, corrupted data) with user-friendly messages
- **Lazy-load all route components** using TanStack Router's `lazyRouteComponent` or dynamic imports so the initial bundle only contains the root layout + auth redirect logic

**Tests:**
- Verify `/login` renders without auth
- Verify `/dashboard` redirects to `/login` when not authenticated
- Verify route type safety (TypeScript errors for invalid paths)
- Verify Suspense fallback renders while route chunk loads
- Verify error boundary catches and displays crypto errors

---

## Step 4 — State Management + Adapter Interfaces ✅

**Goal:** Zustand store, TanStack Query provider, and all adapter interfaces defined.

**Code:**
- Install `zustand`, `@tanstack/react-query`
- Create `src/app/Providers.tsx` — QueryClientProvider + i18n provider
- Create Zustand stores:
  - `src/features/auth/model/auth-store.ts` — session, user, isAuthenticated. **No devtools middleware** — auth tokens must not be exposed in browser DevTools.
  - `src/shared/crypto/crypto-store.ts` — masterKey, KEK, fieldKeys, isVaultLocked (memory only, no persist). **Use plain `Record<string, string>` (hex-encoded) for fieldKeys instead of `Map<string, Uint8Array>`** — Zustand uses `Object.is` for shallow comparison, which fails on Map mutations and Uint8Array references. Hex strings are comparable by value and trigger correct re-renders. **No devtools middleware** — crypto keys must not be exposed in browser DevTools.
  - `src/features/settings/model/ui-store.ts` — sidebarOpen, activeField. **Do NOT store `language` here** — `i18next` is the source of truth for language state. Only store UI state that i18next doesn't manage.
- Create adapter interfaces:
  - `src/shared/auth/auth.types.ts` — `IAuthAdapter` interface: `login(username, authHash)`, `logout()`, `getSession()`, `signup(username, authHash)`, `recoverPassword()`
  - `src/shared/api/api.types.ts` — `IApiAdapter` interface: `getMasterKeyEnvelope(userId)`, `getFieldKeys(userId)`, `getField(userId, fieldName)`, `saveField(userId, fieldName, blob, iv)`, `saveWrappedKey(userId, data)`, `getRecovery(userId)`
  - `src/shared/realtime/realtime.types.ts` — `IRealtimeAdapter` interface: `subscribe(userId, callbacks)`, `unsubscribe()`
- Create `src/shared/types/crypto.types.ts` — TypeScript types for all crypto operations (AesGcmOptions, RecoveryWrapOptions, WrappedFieldKey, EncryptedField, KeyVersion, etc.)

**Tests:**
- Verify Zustand stores initialize correctly
- Verify adapter interfaces compile (no implementation yet)
- Verify crypto types are consistent (AesGcmOptions, WrappedFieldKey, etc.)
- Verify fieldKeys store uses plain Record (not Map) and hex strings (not Uint8Array)

---

## Step 5 — Supabase Local Setup + Database Schema ✅

**Goal:** Local Supabase running via Docker with all tables created and seeded.

**Code:**
- Install Supabase CLI: `pnpm add -D supabase`
- Run `supabase init` — creates `supabase/` directory
- Edit `supabase/config.toml` — configure local project settings
- Create migration files:
  - `supabase/migrations/00001_create_tables.sql`:
    - `users` table (minimal — Supabase Auth manages auth columns)
    - `keys` table (auth_salt, key_salt, wrapped_master_key, master_key_iv) — salts are 16 bytes (32 hex chars), wrapped keys 48 bytes (96 hex chars), IVs 12 bytes (24 hex chars)
    - `field_keys` table (field_name, key_version, wrapped_key, key_iv)
    - `encrypted_fields` table (field_name, encrypted_blob, iv)
    - `recovery` table (recovery_salt, wrapped_master_key, recovery_iv)
  - `supabase/migrations/00002_rls_policies.sql`:
    - RLS policies: users can only CRUD their own data
    - Enable RLS on all tables
  - `supabase/migrations/00003_functions.sql`:
    - Helper function to get current user ID from auth context
- Create `supabase/seed.sql` — dev seed data (test user, test keys, test fields)
- Add `"dev": "supabase start && vite"` to `package.json`
- Add `"dev:reset": "supabase db reset && vite"` to `package.json`
- Document Supabase credentials in `.env.local.example`

**Tests:**
- Verify `supabase start` runs without errors
- Verify `supabase db reset` applies all migrations
- Verify RLS policies: user A cannot read user B's data
- Verify seed data is accessible
