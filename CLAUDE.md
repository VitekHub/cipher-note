# CLAUDE.md — Project Instructions for Claude Code

## Project Overview

Cipher Note is an end-to-end encrypted note-taking app built with Vite + React + TypeScript. Each user has three encrypted fields (note, website, email) protected by a layered key hierarchy. The server never sees plaintext data.

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
- `derive-placeholder.ts` is INSECURE (SHA-256 based) — for dev only, must be replaced before production.

### Crypto Key Hierarchy
```
Password → Split KDF → authHash (Supabase) + passwordKey (unwrap master key)
Master Key → HKDF("wrap") → KEK (wraps field keys) | HKDF("sign") → Signing Key Seed
Field Keys (one per field) → wrapped by KEK with AAD(fieldName, version)
Recovery: BIP-39 mnemonic → Argon2id → recovery KEK → wraps master key
```
- All keys: 32 bytes (256 bits), salts: 16 bytes. Argon2id params: m=47104, t=3, p=1.
- Zustand crypto store uses **hex-encoded strings** (not Uint8Array) for reactivity.
- Vault lock purges Zustand keys + TanStack Query cache.

### App Hierarchy
```
main.tsx → AppProviders (QueryClientProvider > AuthProvider > RouterProvider)
  → __root.tsx (ThemeProvider + Toaster)
    → _public (GuestOnly, redirects to /dashboard if authed)
    → _authenticated (RequireAuth, redirects to /login if not authed)
```

### Database (Supabase / Postgres 17)
- `users` (mirrors auth.users via trigger), `keys`, `field_keys` (versioned), `encrypted_fields`, `recovery`
- All tables use RLS — users can only access their own rows
- No DELETE policy on `recovery` (updatable but not removable)
- Username availability: `check_username_availability()` RPC with IP-based rate limiting

### Adapter Pattern
Backend abstracted behind interfaces: `IAuthAdapter`, `IApiAdapter`, `IRealtimeAdapter` (not yet implemented). Current implementations use Supabase.

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
- Use hex-encoded strings in Zustand stores (not Uint8Array or Map) for proper reactivity.

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
- Zustand for client state (auth store, crypto store, UI store).
- TanStack Query for server state (fields, keys).
- Zustand stores use devtools middleware with named actions **only for stores without sensitive data** (e.g., UI store, vault dialog store). Stores that hold crypto keys or auth tokens (crypto store, auth store) must NOT use devtools — the Redux DevTools extension would expose secrets in browser devtools.
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
  - shadcn/ui primitives (generated by CLI as kebab-case): `button.tsx`, `card.tsx`, `dialog.tsx`, `input.tsx`, `label.tsx`, `sonner.tsx`
  - Context/provider modules that export both a component and a hook: `auth-context.tsx`, `theme-provider.tsx`
  - Route files (TanStack Router convention): `__root.tsx`, `_public.login.tsx`, etc.

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

**Run a single test:** `pnpm test:run -- src/features/auth/model/auth-store.test.ts`

**Setup:** `pnpm install` → `pnpm supabase:start` → copy `.env.local.example` to `.env.local` → fill `VITE_SUPABASE_ANON_KEY` from `pnpm supabase:status` → `pnpm dev`

## Current Progress

See `IMPLEMENTATION-PLAN.md` for the full 36-step plan.
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

### Implementation Notes

Non-obvious decisions not visible from code alone:

- **Auth store `isRestoringSession`**: defaults `true`; `reset()` does NOT touch it (logout doesn't re-trigger initialization)
- **Auto-lock**: `useVaultTimeout` hook in ProtectedLayout resets a 15-minute inactivity timer on user activity (mousemove, keydown, mousedown, touchstart, scroll); calls `lockVault()` on expiry
- **VaultUnlockDialog**: uses a separate `vault-dialog-store` so the dialog can be opened/closed independently of vault lock state. This lets the user dismiss the dialog without unlocking, and lets the sidebar/mobile nav trigger `openUnlockDialog()` directly
- **`lockVault()` vs `clearVault()`**: `lockVault()` preserves the cached envelope (so re-unlock can skip network calls), while `clearVault()` (called on logout) zeros everything including the cache. `unlockVault()` tries the cached envelope first and retries from server on `DecryptionError` (stale cache can happen if the password was changed in another session)
- **Test file naming**: prefix with `-` in `src/app/routes/` to exclude from TanStack Router route tree generation
- **Test setup**: shared setup (`src/test/setup.ts`) resets `useAuthStore` (with `isRestoringSession: false`), `useCryptoStore`, and `useUiStore` (including `sidebarWidth: 240`) in `afterEach`. Router mocking (`@tanstack/react-router`) is done per-file in each test that needs it, not centralized
- **Argon2id Web Worker**: `argon2id.ts` delegates all derivation to `argon2id.worker.ts` via `postMessage`. The worker lazy-loads `argon2-browser/dist/argon2-bundled.min.js` (not the default `argon2-browser` import — the default tries to load a `.wasm` file which Vite cannot handle; the bundled build embeds WASM as base64 in JS). Tests mock the Worker constructor; actual Argon2id computation is tested in E2E (Step 36).
- **FieldCard children pattern**: uses render function `() => ReactNode` so editors aren't mounted when vault is locked
- **FieldCard i18n keys**: `FIELD_I18N_KEYS` is a static record (not template literals) so i18next-parser can discover them
- **`useCurrentUser` hook**: wraps the auth store in `shared/auth/` so features can access user data without cross-feature imports. This is a deliberate exception to the "shared must not import from features" rule — the hook re-exports only what other features need, keeping the dependency surface narrow.
- **`Uint8Array<ArrayBuffer>` for Web Crypto**: TS 6.0 made `Uint8Array` generic; bare `Uint8Array` expands to `Uint8Array<ArrayBufferLike>` which doesn't satisfy `BufferSource`. All `crypto.subtle` function signatures must use `Uint8Array<ArrayBuffer>`.
- **Split KDF master key wrapping uses no AAD**: `changePassword` in `split-kdf.ts` uses `encrypt`/`decrypt` from `aes-gcm.ts` directly (no AAD), not `wrapKey`/`unwrapKey` from `key-wrap.ts`. The master key has no field name or version concept, so AAD is omitted. Field key wrapping still uses AAD via `key-wrap.ts`.
- **HKDF uses `deriveBits`, not `deriveKey`**: `deriveSubKey` returns raw `Uint8Array` bytes because the KEK bytes need to be imported as an AES-GCM CryptoKey via `importKey()` separately in `deriveFullKeyHierarchy`. HKDF uses empty salt since the master key is already random.
- **BIP-39 mnemonic functions are async**: `generateMnemonic`, `validateMnemonic`, `mnemonicToSeed` must be `async` despite the underlying `@scure/bip39` functions being synchronous, because the lazy-loading pattern (`await loadBip39()`) requires it. Same as how `argon2id.ts` wraps sync Argon2 in async.
- **`deriveRecoveryKEK` uses mnemonic string directly**: The mnemonic phrase is passed as the Argon2id "password" parameter, not the BIP-39 binary seed. The human-readable phrase is the input because it is what the user supplies and remembers; the binary seed is an internal derivation artifact. `mnemonicToSeed` is a utility function not used in the recovery KEK path.
- **Crypto integration tests mock `deriveKey` re-consumption**: In `crypto-integration.test.ts`, `unwrapMasterKeyWithRecovery` requires a fresh `deriveKey` mock even after `wrapMasterKeyWithRecovery` consumed one during setup. The `setupRegistration` helper uses `mockResolvedValueOnce` which is consumed, so the test must re-mock before calling unwrap.
- **`deriveRegistrationKeys` is a pure crypto function**: in `features/encryption/model/registration.ts`, it has no side effects (no auth, no DB, no store writes). The orchestration (signup + upload + store population) lives in `auth-flow.ts` `signUpUser`. Do not add side effects to this function.
- **`signUpUser` error cleanup**: on any error after `deriveRegistrationKeys` succeeds, attempts `authAdapter.logout()` as best-effort cleanup (harmless if no session exists, since Supabase signOut with no session is a no-op).
- **Login salt fetch is pre-auth**: `get_login_salts(p_username)` is a SECURITY DEFINER RPC callable by anonymous users, rate-limited (5 req/2 min/IP). Salts must be fetched before auth to derive `authHash` for Supabase Auth, but the `keys` table is RLS-protected. After auth succeeds, `getMasterKeyEnvelope` and `getFieldKeys` fetch wrapped key material through standard RLS-protected queries.
- **Auth error codes fold username format into invalid credentials**: `AuthErrorCode.INVALID_USERNAME_FORMAT` doesn't exist — `supabase-keys.ts` throws `INVALID_CREDENTIALS` for invalid username format. This is deliberate: showing a different error for "wrong format" vs "wrong password" would leak whether a username exists.
- **Network errors can bypass the adapter boundary**: `getAuthErrorMessage` in `auth-error-messages.ts` has an `isNetworkError` fallback because raw `TypeError('Failed to fetch')` from the browser can reach the UI without being wrapped by the adapter. The adapter wraps what it can, but the fallback catches the rest.
