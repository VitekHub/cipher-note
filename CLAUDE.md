# CLAUDE.md — Project Instructions for Claude Code

## Project Overview

Cipher Note is an end-to-end encrypted note-taking app built with Vite + React + TypeScript. Each user has multiple entries, each containing four encrypted fields (title, note, website, email) protected by a layered key hierarchy. The server never sees plaintext data.

## No Backward Compatibility

This app will never need backward compatibility with previous versions. The database is always reset on changes. Do not add migration paths, version checks, or compatibility shims for old data formats.

## Architecture

### Tech Stack
React 19 · TypeScript (strict, `erasableSyntaxOnly`, `verbatimModuleSyntax`) · Vite 8 · Tailwind CSS v4 · shadcn/ui (base-nova) · TanStack Router (file-based) · TanStack Query 5 · Zustand 5 · react-hook-form + Zod 4 · i18next (en + cs) · Supabase (local Docker) · Web Crypto API + argon2-browser

### Auth (Split KDF / Zero-Knowledge)
- Users log in with a **username** (mapped to `{username}@ciphernote.internal` for Supabase Auth, which requires an email).
- Password never leaves the client. **Split KDF** derives two independent values:
  1. `authHash` → sent as the "password" to Supabase Auth (always 64 hex chars)
  2. `passwordKey` → used locally to unwrap the master key
- Argon2id runs in a **Web Worker** (`argon2id.worker.ts`). `@scure/bip39` and `argon2-browser` are lazy-loaded, never top-level imports.

### Crypto Key Hierarchy
```
Password → Split KDF → authHash (Supabase) + passwordKey (unwrap master key)
Master Key → HKDF("wrap") → KEK (wraps field keys) | HKDF("sign") → Signing Key Seed
Master Key → wrapped by passwordKey with AAD("master") or recovery KEK with AAD("recovery")
Recovery: BIP-39 mnemonic → Argon2id → recovery KEK → wraps master key
Field Keys (one per field) → wrapped by KEK with AAD(fieldName, version)
```
- All keys: 32 bytes (256 bits), salts: 16 bytes. Argon2id params: m=47104, t=3, p=1.
- `KeyVault` class (`key-vault.ts`) stores non-extractable `CryptoKey` objects in a module-scoped `Map`. Keys are identified by well-known IDs: `kek`, `title`, `note`, `website`, `email`. Zustand crypto store (`crypto-store.ts`) only tracks which field names are loaded (`loadedFieldKeys: Record<string, boolean>`).
- Vault lock purges key vault Map + Zustand state + TanStack Query cache.

### App Hierarchy
```
main.tsx → AppProviders (QueryClientProvider > AuthProvider > RouterProvider)
  → __root.tsx (ThemeProvider + Toaster)
    → _public (redirects to /dashboard if authed — guard in route beforeLoad)
      → /login, /register, /recover
    → _authenticated (redirects to /login if not authed — guard in route beforeLoad)
      → /dashboard (shows EmptyState if no entries, or DashboardWelcome)
      → /dashboard/$entryId (entry detail with field editors)
      → /settings
```

### Database (Supabase / Postgres 17)
- `users` (mirrors auth.users via trigger), `login_salts`, `master_keys`, `field_keys` (versioned), `entries`, `encrypted_fields`, `recovery_keys`
- All tables use RLS — users can only access their own rows
- `anon` role has all privileges revoked on tables (only SECURITY DEFINER RPCs are callable by anon)
- `encrypted_fields.user_id` is denormalized from `entries` for simple RLS policies (`USING (user_id = auth.uid())` avoids a JOIN on every policy check)
- No DELETE policy on `recovery_keys` (updatable but not removable)
- Username availability: `check_username_availability()` RPC with IP-based rate limiting (10 req/2 min/IP)
- Login salts: `get_login_salts()` RPC, pre-auth, rate-limited (5 req/2 min/IP)
- Recovery RPCs: `get_recovery_data(p_username)` pre-auth (5 req/2 min/IP), `recover_account(...)` pre-auth (3 req/15 min/IP), `save_recovery_data(...)` authenticated (bcrypt-hashes `recoveryAuthHash`)
- `recovery_keys` table has a `recovery_auth_hash` column (bcrypt hash of HKDF-derived proof-of-knowledge)

### Adapter Pattern
Backend abstracted behind interfaces: `IAuthAdapter`, `IRealtimeAdapter`. There is no `IApiAdapter` — the data layer uses direct Supabase functions instead. Current implementations: auth in `supabase-adapter.ts`, entry CRUD in `supabase-entries.ts`, field CRUD in `supabase-fields.ts`, key operations in `supabase-keys.ts`, recovery RPCs in `supabase-recovery.ts`, registration upload in `supabase-registration.ts`, realtime in `supabase-realtime.ts`.

## Key Conventions

### File Organization
- `src/app/` — Application shell (providers, router, layouts, styles, routes)
- `src/features/` — Feature modules, each with `model/`, `ui/`, and optionally `lib/`
- `src/shared/` — Shared code (ui components, crypto, api adapters, auth, i18n, types)
- Dependency direction: `routes -> features -> shared`. NEVER import from features into shared, or from one feature into another.

### No Barrel Files
- NEVER create `index.ts` barrel files in any directory.
- Always import directly by path: `import { Button } from '@/shared/ui/button'`
- This applies to ALL directories: `shared/ui/`, `shared/crypto/`, `shared/auth/`, etc.

### File Size
- Target 100-200 lines per file. Maximum 300 lines.
- If a file exceeds 300 lines, split it.
- Prefer deep folder hierarchies over wide shallow files.

### Prettier
- No semicolons, single quotes, trailing commas, 120 print width, tailwindcss plugin.

### Testing
- Tests are colocated with source: `aes-gcm.ts` -> `aes-gcm.test.ts` in the same directory.
- No separate `__tests__/` folders.
- Use the custom `render` from `@/test/utils` which wraps components with ThemeProvider.
- Use `vitest` globals (`describe`, `it`, `expect`) — enabled in vitest config.

### Crypto Security
- NEVER import `argon2-browser` or `@scure/bip39` at the top level of any module that loads on app startup.
- These MUST be dynamically imported. For `argon2-browser`, use the bundled build to avoid Vite WASM loading issues: `const argon2 = await import('argon2-browser/dist/argon2-bundled.min.js')`. The default import (`argon2-browser`) tries to load a `.wasm` file which Vite cannot handle. The bundled build embeds WASM as base64 in JS. A module declaration in `src/env.d.ts` maps the bundled path to `argon2-browser` types.
- The Vite config already has manual chunks for these modules to keep them out of the initial bundle.
- NEVER persist crypto keys to localStorage, sessionStorage, or IndexedDB.
- Crypto keys live in `KeyVault` as non-extractable `CryptoKey` objects, not in Zustand.

### Styling
- Tailwind CSS v4 with `@import "tailwindcss"` and `@theme` in `src/app/styles/globals.css`.
- Dark theme is default. The `<html>` element has `class="dark"`.
- Use shadcn/ui components from `@/shared/ui/`.
- When adding new shadcn components: `npx shadcn@latest add <component>` and they go to `src/shared/ui/`.
- Always use the `cn()` utility from `@/shared/lib/utils` for conditional classes.

### Import Paths
- `@/*` resolves to `src/*`.
- Example: `import { Button } from '@/shared/ui/button'`
- Example: `import { useAuthStore } from '@/features/auth/model/auth-store'`

### Path Aliases in TypeScript
- Path aliases are configured in `tsconfig.app.json` with `"ignoreDeprecations": "6.0"` for TS 6 compatibility.
- When adding a new alias, update `tsconfig.app.json` AND `vite.config.ts`.

### State Management
- Zustand for client state (auth store, crypto store, layout store).
- TanStack Query for server state (fields, keys).
- Zustand stores use devtools middleware with named actions **only for stores without sensitive data** (e.g., layout store, vault dialog store). Stores that hold crypto keys or auth tokens (crypto store, auth store) must NOT use devtools — the Redux DevTools extension would expose secrets in browser devtools.
- NEVER store `language` preference in Zustand — `i18next` is the source of truth.

### Code Style
- Use TypeScript strict mode.
- Use named exports (no default exports except for page/route components and React components).
- Use `function` declarations for React components, not arrow functions assigned to `const`.
- Always define components OUTSIDE other components (no inline component definitions).
- Use statically analyzable import paths (no template literal imports).
- Always end files with a trailing newline (matches Prettier's `--insert-final-newline` behavior).

### File Naming
- **Component files** (`.tsx` that export a React component): PascalCase — e.g., `LoginPage.tsx`, `FormField.tsx`
- **Non-component files** (utilities, models, schemas, types, hooks, tests): kebab-case — e.g., `auth-store.ts`, `login-schema.ts`
- **Exceptions that stay kebab-case:**
  - shadcn/ui primitives (generated by CLI as kebab-case): `button.tsx`, `card.tsx`, `dialog.tsx`, `input.tsx`, `label.tsx`, `sonner.tsx`, `alert-dialog.tsx`
  - Context modules that export a context and a hook: `auth-context.tsx`; Provider components that export only a component: `auth-provider.tsx`, `theme-provider.tsx`
  - Route files (TanStack Router convention): `__root.tsx`, `_public.login.tsx`, etc.
  - Feature UI components that export a named component: `CreateEntryButton.tsx`, `DeleteEntryDialog.tsx`, `InputField.tsx`, `LockedVaultCard.tsx`

## Development Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start Supabase Docker + Vite dev server |
| `pnpm dev:reset` | Reset DB (re-run migrations + seed) then start dev |
| `pnpm build` | `tsc -b && vite build` |
| `pnpm test` | Vitest in watch mode |
| `pnpm test:run` | Vitest single run |
| `pnpm test:ui` | Vitest UI |
| `pnpm coverage` | Vitest with v8 coverage |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier write |
| `pnpm format:check` | Prettier check |
| `pnpm supabase:start` | Start local Supabase (requires Docker) |
| `pnpm supabase:status` | Show Supabase URLs + keys |
| `pnpm supabase:reset` | Reset DB with migrations + seed |

**Run a single test:** `pnpm test:run src/features/auth/model/auth-store.test.ts`

**Setup:** `pnpm install` → `pnpm supabase:start` → copy `.env.local.example` to `.env.local` → fill `VITE_SUPABASE_ANON_KEY` from `pnpm supabase:status` → `pnpm dev`

## Current Progress

See `docs/implementation-plan/README.md` for the full 36-step plan.
- Step 1 (Project Scaffolding + UI Foundation) — complete
- Step 2 (i18n Setup) — complete
- Step 3 (Router + Route Structure + Suspense Boundaries) — complete
- Step 4 (State Management + Adapter Interfaces) — complete
- Step 5 (Supabase Local Setup + Database Schema) — complete
- Step 6 (Supabase Auth Adapter + Username Auth) — complete
- Step 7 (Auth UI: Register + Login Pages) — complete
- Step 8 (Auth State + Protected Routes) — complete
- Step 9 (Dashboard Layout — Responsive) — complete
- Step 10 (Dashboard Page Shell + Field Components) — complete
- Step 11 (Settings Page Shell) — complete
- Step 12 (AES-256-GCM Encrypt/Decrypt) — complete
- Step 13 (Key Wrapping/Unwrapping) — complete
- Step 14 (Argon2id Key Derivation) — complete
- Step 15 (HKDF Key Derivation + Key Hierarchy) — complete
- Step 16 (Split KDF Module) — complete
- Step 17 (BIP-39 Mnemonic Module) — complete
- Step 18 (Crypto Integration Tests) — complete
- Step 19 (Registration Crypto Flow) — complete
- Step 20 (Registration UI) — complete
- Step 21 (Login Crypto Flow) — complete
- Step 22 (Login UI + Vault Unlock) — complete
- Step 23 (Non-Extractable Key Vault + Zustand Store Refactor) — complete
- Step 24 (Supabase API Adapter) — complete
- Step 25 (Encrypted Field CRUD) — complete
- Step 26 (Auto-Save + Sync Flow) — complete
- Step 27 (Supabase Realtime Adapter) — complete
- Step 28 (Multi-Device Session Handling) — complete
- Step 29 (Change Password Flow + UI) — complete
- Step 30 (Regenerate Seed Phrase) — complete
- Step 31 (Seed Phrase Recovery Flow + UI) — complete

### Implementation Notes

Non-obvious decisions not visible from code alone:

- **Auth store `isRestoringSession`**: defaults `true`; `reset()` does NOT touch it (logout doesn't re-trigger initialization)
- **Auto-lock**: `useVaultTimeout` hook in ProtectedLayout resets a 15-minute inactivity timer on user activity (mousemove, keydown, mousedown, touchstart, scroll); calls `lockVault()` on expiry
- **VaultUnlockDialog**: uses a separate `vault-dialog-store` (in `features/vault/model/vault-dialog-store.ts`) created via `createDialogStore` factory. The dialog can be opened/closed independently of vault lock state. This lets the user dismiss the dialog without unlocking, and lets the sidebar/mobile nav trigger `open()` directly
- **`keyVault.lockVault()` vs `keyVault.clearVault()`**: `lockVault()` preserves the cached envelope (so re-unlock can skip network calls), while `clearVault()` (called on logout) zeros everything including the cache. `keyVault.unlockVault()` tries the cached envelope first and retries from server on `DecryptionError` (stale cache can happen if the password was changed in another session)
- **Test file naming**: prefix with `-` in `src/app/routes/` to exclude from TanStack Router route tree generation
- **Test setup**: shared setup (`src/test/setup.ts`) resets `useAuthStore` (with `isRestoringSession: false`), `useCryptoStore`, and `useLayoutStore` (including `sidebarWidth: 240`) in `afterEach`. Router mocking (`@tanstack/react-router`) is done per-file in each test that needs it, not centralized
- **Argon2id Web Worker**: `argon2id.ts` delegates all derivation to `argon2id.worker.ts` via `postMessage`. The worker lazy-loads `argon2-browser/dist/argon2-bundled.min.js` (not the default `argon2-browser` import — the default tries to load a `.wasm` file which Vite cannot handle; the bundled build embeds WASM as base64 in JS). Tests mock the Worker constructor; actual Argon2id computation is tested in E2E (Step 36).
- **FieldCard children pattern**: uses render function `() => ReactNode`. Field editors stay mounted (hidden via CSS) when vault is locked so paused mutation observers survive and their callbacks fire on resume. Locked UI is handled by `LockedVaultCard` in the dashboard, not by individual FieldCards.
- **FieldCard i18n keys**: `FIELD_LABEL_KEYS` is a static record (not template literals) so i18next-parser can discover them. Includes all four fields: title, note, website, email.
- **`Uint8Array<ArrayBuffer>` for Web Crypto**: TS 6.0 made `Uint8Array` generic; bare `Uint8Array` expands to `Uint8Array<ArrayBufferLike>` which doesn't satisfy `BufferSource`. All `crypto.subtle` function signatures must use `Uint8Array<ArrayBuffer>`.
- **`copyToUint8Array` only in aes-gcm.ts**: Web Crypto's `encrypt`, `decrypt`, and `exportKey` return `ArrayBuffer`, which can be neutered/transferred. `copyToUint8Array` wraps these calls and provides type narrowing to `Uint8Array<ArrayBuffer>`. Other crypto modules construct `Uint8Array` from scratch (e.g., `new Uint8Array(derivedBits)`) so they already own the buffer.
- **Multi-entry architecture**: Each user can have multiple entries. An entry is a group of four encrypted fields (title, note, website, email). The `entries` table stores entry metadata; `encrypted_fields` references `entry_id`. Entry CRUD is in `entry-service.ts` + `use-entry.ts` hooks. The sidebar shows the entry list; the dashboard route `/dashboard` shows `EmptyState` (if no entries) or `DashboardWelcome`, while `/dashboard/$entryId` shows the entry detail.
- **`useField` and `useSaveField` are entry-aware**: Query keys include `entryId` via the centralized `queryKeys` factory (`src/shared/lib/query-keys.ts`). On entry deletion, `useDeleteEntry` removes field queries for that entry from the cache.
- **Master key wrapping uses AAD constants**: All key wrapping is done directly with `encrypt`/`decrypt` from `aes-gcm.ts` using `{iv, aad}` options. `rewrapMasterKey` in `master-key.ts` uses `MASTER_KEY_PASSWORD_AAD`, recovery wrapping in `mnemonic.ts` uses `MASTER_KEY_RECOVERY_AAD`, field key wrapping uses `encodeAAD(fieldName, version)` from `crypto-utils.ts`.
- **HKDF uses `deriveBits`, not `deriveKey`**: `hkdfExpand` in `hkdf.ts` returns raw `Uint8Array` bytes because the KEK bytes need to be imported as an AES-GCM CryptoKey via `importKey()` separately. `deriveKEK` and `deriveSigningKeySeed` are convenience wrappers. HKDF uses empty salt since the PRK is already random.
- **BIP-39 mnemonic functions are async**: `generateMnemonic`, `validateMnemonic`, `mnemonicToSeed` in `mnemonic.ts` must be `async` despite the underlying `@scure/bip39` functions being synchronous, because the lazy-loading pattern (`await loadBip39()`) requires it. Same as how `argon2id.ts` wraps sync Argon2 in async.
- **`deriveRecoveryKEK` uses mnemonic string directly**: In `mnemonic.ts`, the mnemonic phrase is passed as the Argon2id "password" parameter, not the BIP-39 binary seed. The human-readable phrase is the input because it is what the user supplies and remembers; the binary seed is an internal derivation artifact. `mnemonicToSeed` is a utility function not used in the recovery KEK path. `wrapMasterKeyWithRecovery` and `unwrapMasterKeyWithRecovery` zero-fill the recovery KEK in a `finally` block and also derive `recoveryAuthHash` via `HKDF_INFO.RECOVERY_AUTH`.
- **Crypto integration tests mock `deriveKey` re-consumption**: In `crypto-integration.test.ts` (in `shared/crypto/`), `unwrapMasterKeyWithRecovery` requires a fresh `deriveKey` mock even after `wrapMasterKeyWithRecovery` consumed one during setup. The `setupRegistration` helper uses `mockResolvedValueOnce` which is consumed, so the test must re-mock before calling unwrap.
- **`deriveRegistrationKeys` is a pure crypto function**: in `features/auth/model/registration-crypto.ts`, it has no side effects (no auth, no DB, no store writes). The orchestration (signup + upload + store population) lives in `features/auth/model/auth-service.ts` `signUpUser`. Do not add side effects to this function.
- **`signUpUser` error cleanup**: on any error after `deriveRegistrationKeys` succeeds, attempts `authAdapter.logout()` as best-effort cleanup (harmless if no session exists, since Supabase signOut with no session is a no-op).
- **`saveRecoveryData` uses RPC**: Registration and regeneration both call `saveRecoveryData()` in `supabase-recovery.ts`, which invokes the `save_recovery_data` SECURITY DEFINER function. This RPC bcrypt-hashes `recoveryAuthHash` before storage, ensuring the raw HKDF-derived value never appears in the DB. Direct table inserts into `recovery_keys` are not used anywhere.
- **Pre-auth RPCs**: `get_login_salts(p_username)` and `get_recovery_data(p_username)` are SECURITY DEFINER RPCs callable by anonymous users, rate-limited (5 req/2 min/IP). Salts must be fetched before auth to derive `authHash` for Supabase Auth, but the `master_keys` table is RLS-protected. After auth succeeds, `fetchMasterKeyEnvelope` and `fetchFieldKeys` fetch wrapped key material through standard RLS-protected queries. `recover_account` is also pre-auth but more strictly rate-limited (3 req/15 min/IP).
- **Auth error codes fold username format into invalid credentials**: `AuthErrorCode.INVALID_USERNAME_FORMAT` doesn't exist — `supabase-keys.ts` throws `INVALID_CREDENTIALS` for invalid username format. This is deliberate: showing a different error for "wrong format" vs "wrong password" would leak whether a username exists. Missing key data is `ApiError(NOT_FOUND)`, not an auth error — `KEYS_NOT_FOUND` was removed from `AuthErrorCode` because "data not found" is a data-layer concern, not an auth concern.
- **`AuthError` vs `ApiError` domain boundary**: `AuthError` (in `shared/auth/auth-errors.ts`) covers authentication errors (`INVALID_CREDENTIALS`, `USERNAME_TAKEN`, `NETWORK_ERROR`, `UNEXPECTED`). `ApiError` (in `shared/api/api-errors.ts`) covers data-layer errors (`NETWORK_ERROR`, `NOT_FOUND`, `UNEXPECTED`). `fetchLoginSalts` throws `AuthError` because it's a pre-auth RPC that's part of the login flow; all other data queries throw `ApiError`. Each domain has its own `wrapXxxError` that classifies raw errors using the shared `isNetworkError` helper.
- **Network errors can bypass the adapter boundary**: `isNetworkError` (in `shared/lib/network-errors.ts`) is shared by both `wrapAuthError` and `wrapApiError`. Raw `TypeError('Failed to fetch')` from the browser can reach the UI without being wrapped by any adapter, so `getAuthErrorMessage` in `auth-error-messages.ts` also calls `isNetworkError` as a final fallback.
- **Change password rollback**: `changeUserPassword` in `auth-service.ts` is a 4-step flow (derive → upload envelope → update auth → update store). If step 3 (Supabase Auth update) fails after step 2 (DB envelope upload) succeeds, it attempts to roll back the DB write with the old envelope values. If rollback also fails, it forces logout to prevent inconsistent state.
- **Stale KEK detection**: Stale KEK from a password change on another device is detected in two places: (1) `use-realtime-sync.ts` `onKeyRotation` — when a key rotation event arrives, `syncFieldKeys` tries to unwrap with the current KEK; a `DecryptionError` means the KEK is stale, so `clearVault()` forces re-auth. (2) `key-vault.ts` `unlockVault` — if the cached envelope is stale, `clearVault` + retry from server. The save path (`useSaveField`) cannot produce a `DecryptionError` — `encryptField` only encrypts, and `getFieldKey` throws a generic `Error` when the vault is locked, not `DecryptionError`.
- **`recoveryAuthHash` for proof-of-knowledge**: `wrapMasterKeyWithRecovery` and `unwrapMasterKeyWithRecovery` in `mnemonic.ts` derive a `recoveryAuthHash` via `HKDF_INFO.RECOVERY_AUTH` from the recovery KEK, and zero-fill the KEK in a `finally` block. The server stores a bcrypt hash of this value (via `save_recovery_data` RPC — never a direct table insert), so the raw HKDF-derived value never appears in the DB. The `recover_account` RPC verifies this proof before atomically updating auth password, salts, and master key.
- **Account recovery is a two-step client flow**: `RecoveryFlow` class in `mnemonic-service.ts` holds state (`username`, `masterKey`, `recoveryAuthHash`) between `validateMnemonic()` and `setNewPassword()`. Master key is zero-filled in `clear()` (called on unmount, not in React state — to avoid devtools exposure). `recover_account` RPC is atomic on the server side; if the RPC succeeds but automatic login fails, a `RecoveryLoginError` is thrown and the user is redirected to `/login` with a success toast.

