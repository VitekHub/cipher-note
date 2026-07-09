# CLAUDE.md — Project Instructions for Claude Code

## Project Overview

Cipher Note is an end-to-end encrypted note-taking app built with Vite + React + TypeScript. Each user has multiple entries, each containing four encrypted fields (title, note, website, email) protected by a layered key hierarchy. The server never sees plaintext data.

## Backward Compatibility

This app **must maintain backward compatibility** with previous versions. Existing users' data must continue to work after schema or crypto changes. Always add proper migration paths, version checks, and compatibility shims for old data formats. Database changes must be additive (new columns with defaults, new tables) or include migration scripts that transform existing data. Never drop columns or tables that existing users depend on without a migration path.

## Architecture

### Tech Stack
React 19 · TypeScript (strict, `erasableSyntaxOnly`, `verbatimModuleSyntax`) · Vite 8 · Tailwind CSS v4 · shadcn/ui (base-nova) · TanStack Router (file-based) · TanStack Query 5 · Zustand 5 · react-hook-form + Zod 4 · i18next (en + cs) · Supabase (local Docker) · Web Crypto API + argon2-browser · Playwright (E2E)

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
main.tsx → AppErrorBoundary → AppProviders (QueryClientProvider > AuthProvider > RouterProvider)
  → __root.tsx (ThemeProvider + Toaster)
    → _public (redirects to /dashboard if authed — guard in route beforeLoad)
      → /login, /register, /recover
    → _authenticated (redirects to /login if not authed — guard in route beforeLoad)
      → /dashboard (shows EmptyState if no entries, or DashboardWelcome)
      → /dashboard/$entryId (entry detail with field editors)
      → /settings (PreferencesSection, SecuritySection, AccountSection, AboutSection)
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
- Key rotation RPC: `rotate_field_key(p_payload)` authenticated SECURITY DEFINER — atomic: insert new wrapped key version, update all ciphertexts for that field, delete old key versions in one transaction
- Delete account RPC: `delete_account()` authenticated SECURITY DEFINER — deletes from `auth.users`, cascading through all public tables via ON DELETE CASCADE foreign keys. The client must verify the user's password before calling this RPC.
- `recovery_keys` table has a `recovery_auth_hash` column (bcrypt hash of HKDF-derived proof-of-knowledge)

### Adapter Pattern
Backend abstracted behind interfaces: `IAuthAdapter`, `IRealtimeAdapter`. There is no `IApiAdapter` — the data layer uses direct Supabase functions instead. Current implementations: auth in `supabase-adapter.ts`, entry CRUD in `supabase-entries.ts`, field CRUD in `supabase-fields.ts`, key operations in `supabase-keys.ts`, recovery RPCs in `supabase-recovery.ts`, registration upload in `supabase-registration.ts`, account deletion in `supabase-account.ts`, realtime in `supabase-realtime.ts`.

## Key Conventions

### File Organization
- `src/app/` — Application shell (providers, router, layouts, styles, routes)
- `src/features/` — Feature modules, each with `model/`, `ui/`, and optionally `lib/`
- `src/shared/` — Shared code (ui components, crypto, api adapters, auth, i18n, types)
- Dependency direction: `routes -> features -> shared`. NEVER import from features into shared, or from one feature into another.
- `src/shared/stores/` — Shared Zustand stores: `dialogs-store.ts` (dialog open/close state via `createDialogStore` factory), `vault-settings-store.ts`, `create-dialog-store.ts` (factory with optional payload support).

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
- Unit/integration tests are colocated with source: `aes-gcm.ts` -> `aes-gcm.test.ts` in the same directory.
- E2E tests live in `e2e/` (Playwright). Config in `playwright.config.ts`; runs against a production build on port 4173.
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
| `pnpm test:e2e` | Playwright E2E tests |
| `pnpm test:e2e:ui` | Playwright E2E tests with UI |
| `pnpm coverage` | Vitest with v8 coverage |
| `pnpm typecheck` | `tsc --noEmit` for app, node, and e2e configs |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier write |
| `pnpm format:check` | Prettier check |
| `pnpm validate` | Format + test:run + lint + typecheck |
| `pnpm supabase:start` | Start local Supabase (requires Docker) |
| `pnpm supabase:status` | Show Supabase URLs + keys |
| `pnpm supabase:stop` | Stop local Supabase |
| `pnpm supabase:reset` | Reset DB with migrations + seed |

**Run a single test:** `pnpm test:run src/features/auth/model/auth-store.test.ts`

**Setup:** `pnpm install` → `pnpm supabase:start` → copy `.env.local.example` to `.env.local` → fill `VITE_SUPABASE_ANON_KEY` from `pnpm supabase:status` → `pnpm dev`

### Implementation Notes

Non-obvious decisions not visible from code alone:

- **Auth store `isRestoringSession`**: defaults `true`; `reset()` does NOT touch it (logout doesn't re-trigger initialization)
- **VaultUnlockDialog**: uses a separate `vault-dialog-store` (in `features/vault/model/vault-dialog-store.ts`) created via `createDialogStore` factory from `shared/stores/create-dialog-store.ts`. The dialog can be opened/closed independently of vault lock state. This lets the user dismiss the dialog without unlocking, and lets the sidebar/mobile nav trigger `open()` directly. Other dialog stores (`ChangePasswordDialogStore`, `DeleteAccountDialogStore`, `RotateFieldKeyDialogStore`, etc.) are in `shared/stores/dialogs-store.ts` using the same factory.
- **FieldCard children pattern**: uses render function `() => ReactNode`. Field editors stay mounted (hidden via CSS) when vault is locked so paused mutation observers survive and their callbacks fire on resume. Locked UI is handled by `LockedVaultCard` in the dashboard, not by individual FieldCards.
- **FieldCard i18n keys**: `FIELD_LABEL_KEYS` is a static record (not template literals) so i18next-parser can discover them. Includes all four fields: title, note, website, email.
- **`Uint8Array<ArrayBuffer>` for Web Crypto**: TS 6.0 made `Uint8Array` generic; bare `Uint8Array` expands to `Uint8Array<ArrayBufferLike>` which doesn't satisfy `BufferSource`. All `crypto.subtle` function signatures must use `Uint8Array<ArrayBuffer>`.
- **`copyToUint8Array` only in aes-gcm.ts**: Web Crypto's `encrypt`, `decrypt`, and `exportKey` return `ArrayBuffer`, which can be neutered/transferred. `copyToUint8Array` wraps these calls and provides type narrowing to `Uint8Array<ArrayBuffer>`. Other crypto modules construct `Uint8Array` from scratch (e.g., `new Uint8Array(derivedBits)`) so they already own the buffer.
- **HKDF uses `deriveBits`, not `deriveKey`**: `hkdfExpand` in `hkdf.ts` returns raw `Uint8Array` bytes because the KEK bytes need to be imported as an AES-GCM CryptoKey via `importKey()` separately. `deriveKEK` and `deriveSigningKeySeed` are convenience wrappers. HKDF uses empty salt since the PRK is already random.
- **`saveRecoveryData` uses RPC**: Registration and regeneration both call `saveRecoveryData()` in `supabase-recovery.ts`, which invokes the `save_recovery_data` SECURITY DEFINER function. This RPC bcrypt-hashes `recoveryAuthHash` before storage, ensuring the raw HKDF-derived value never appears in the DB. Direct table inserts into `recovery_keys` are not used anywhere.
- **Auth error codes fold username format into invalid credentials**: `AuthErrorCode.INVALID_USERNAME_FORMAT` doesn't exist — `supabase-keys.ts` throws `INVALID_CREDENTIALS` for invalid username format. This is deliberate: showing a different error for "wrong format" vs "wrong password" would leak whether a username exists. Missing key data is `ApiError(NOT_FOUND)`, not an auth error — `KEYS_NOT_FOUND` was removed from `AuthErrorCode` because "data not found" is a data-layer concern, not an auth concern.
- **Network errors can bypass the adapter boundary**: `isNetworkError` (in `shared/lib/network-errors.ts`) is shared by both `wrapAuthError` and `wrapApiError`. Raw `TypeError('Failed to fetch')` from the browser can reach the UI without being wrapped by any adapter, so `getAuthErrorMessage` in `auth-error-messages.ts` also calls `isNetworkError` as a final fallback.
- **Stale KEK detection**: Stale KEK from a password change on another device is detected in two places: (1) `use-realtime-sync.ts` `onKeyRotation` — when a key rotation event arrives (from password change or field-key rotation on another session), `syncFieldKeys` tries to unwrap with the current KEK; a `DecryptionError` means the KEK is stale, so `clearVault()` forces re-auth. If the vault is locked, the cached envelope is cleared so the next unlock fetches fresh key material. Local rotations are echo-suppressed via `markLocalKeyRotation`/`isLocalKeyRotationEcho`. (2) `key-vault.ts` `unlockVault` — if the cached envelope is stale, `clearVault` + retry from server. The save path (`useSaveField`) cannot produce a `DecryptionError` — `encryptField` only encrypts, and `getFieldKey` throws a generic `Error` when the vault is locked, not `DecryptionError`.
- **Account recovery is a two-step client flow**: `RecoveryFlow` class in `mnemonic-service.ts` holds state (`username`, `masterKey`, `recoveryAuthHash`) between `validateMnemonic()` and `setNewPassword()`. Master key is zero-filled in `clear()` (called on unmount, not in React state — to avoid devtools exposure). `recover_account` RPC is atomic on the server side; if the RPC succeeds but automatic login fails, a `RecoveryLoginError` is thrown and the user is redirected to `/login` with a success toast.
- **App version is an i18n key, not a build-time constant**: The displayed version (`v1.0.0`) lives in `common.json` as `app.version`, NOT in `package.json` or Vite's `define`. This means it's updated manually on release by editing both locale files (`en/common.json` and `cs/common.json`). The GitHub URL (`app.githubUrl`) and license (`app.license`) follow the same pattern. The About section in Settings (`AboutSection.tsx`) displays these via i18n keys. `package.json` `version` is for npm tooling only (no `v` prefix).

