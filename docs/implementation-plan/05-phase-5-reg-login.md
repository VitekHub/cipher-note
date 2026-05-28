# Phase 5: Registration & Login Flows ✅

## Step 19 — Registration Crypto Flow ✅

**Goal:** Wire up the full registration flow: derive keys, wrap, store on server.

**Code:**
- `src/features/encryption/model/registration.ts`:
  - `deriveRegistrationKeys(password: string): Promise<RegistrationResult>` — pure crypto function with no side effects (no auth calls, no DB writes). The auth orchestration (signup, upload, store population) remains in the auth operations module.
    1. Generate salts (auth_salt, key_salt) via `generateSalt()` from `crypto-utils.ts`
    2. Derive auth credentials: auth_hash + password_key
    3. Generate master key (256-bit random)
    4. Derive key hierarchy: KEK, signing key seed
    5. Generate field keys: note, website, email (256-bit random each, version 1)
    6. Wrap field keys with KEK using `encrypt` (AAD = `encodeAAD(field_name, version)`, IV via `generateIV()`)
    7. Wrap master key with password key using `encrypt` (AAD = `MASTER_KEY_PASSWORD_AAD`, IV via `generateIV()`)
    8. Generate recovery mnemonic
    9. Wrap master key with recovery KEK using `encrypt` (AAD = `MASTER_KEY_RECOVERY_AAD`, IV via `generateIV()`)
    10. Export KEK CryptoKey to raw bytes (for hex-encoding into crypto store)
    11. Return all data needed to upload to server
- `RegistrationResult` type: all wrapped keys, salts, IVs, recovery data, mnemonic. `kek` is `Uint8Array<ArrayBuffer>` (exported from CryptoKey), not `CryptoKey`
- `src/shared/api/supabase-registration.ts`:
  - `uploadRegistrationData(data: RegistrationResult, userId: string): Promise<void>`
    - Call Supabase client directly to store: keys, field_keys, recovery (hex-encode all binary values)
- `src/shared/crypto/crypto-utils.ts` (defined in Step 12):
  - `hexEncode` / `hexDecode` — used by registration flow to encode binary keys for Zustand storage and decode server hex strings for crypto operations
  - `zeroFill` — securely overwrite sensitive key material after use
- `src/app/flows/auth-flow.ts`
  - `signUpUser(username: string, password: string): Promise<string>` — orchestrates the full registration flow: derives keys, signs up via auth adapter, uploads registration data, populates crypto store with hex-encoded keys, returns mnemonic as a string. Sets auth store loading state. On upload failure after successful signup, attempts best-effort cleanup via `authAdapter.logout()`
  - `loginUser`, `logoutUser`, `restoreSession`, `subscribeToAuthChanges` — move from `features/auth/model/auth-credentials.ts` (and delete). These functions will be replaced by proper flow-level implementations in Steps 21–23.
- Update `IAuthAdapter.signup` to remove `keySalt` parameter — salts are stored in the `keys` table by `supabase-registration.ts`, not in `user_metadata`
- Fix SQL salt CHECK constraints: salt columns use `CHECK (length(...) = 32)` (16 bytes → 32 hex chars), not 64
- Handle error cases: on any error after `deriveRegistrationKeys`, attempt best-effort cleanup via `authAdapter.logout()`

**Tests:**
- Unit: `deriveRegistrationKeys` returns all required fields (wrapped keys, salts, IVs, mnemonic)
- Unit: returned wrapped master key can be unwrapped with password_key
- Unit: returned wrapped field keys can be unwrapped with derived KEK
- Unit: mnemonic can unwrap master key via recovery KEK
- Unit: `uploadRegistrationData` inserts correct hex-encoded values into correct tables
- Unit: `signUpUser` calls signup, upload, and populates crypto store
- Unit: `signUpUser` attempts cleanup logout on upload failure

---

## Step 20 — Registration UI ✅

**Goal:** Registration page with password strength indicator and mnemonic display.

**Code:**
- Inline forms directly into `LoginPage.tsx` and `RegisterPage.tsx` (no shared `AuthForm` wrapper — each page owns its own form logic and layout). Extract shared password validation logic to `src/shared/auth/password-utils.ts`.
- `RegisterPage.tsx`:
  - `signUpUser` returns `mnemonic: string` — capture the mnemonic from `signUpUser`'s return value and pass it to `MnemonicDialog`.
  - Show Argon2id derivation progress (spinner or progress indicator)
  - On success: show mnemonic in a `<Dialog>` with:
    - 12-word mnemonic displayed in groups of 3
    - "Copy to clipboard" button
    - "Download as text file" button
    - Warning text: "Store this seed phrase securely. It cannot be recovered if lost."
    - Checkbox: "I have stored my seed phrase" (required before continuing)
  - On "Continue" after mnemonic confirmation: redirect to `/dashboard`
  - Error states: username taken, network error
- Create `src/features/auth/ui/MnemonicDialog.tsx` — reusable mnemonic display component
- Create `src/features/auth/ui/PasswordStrength.tsx` — password strength indicator
- Add i18n strings to `auth.json` for registration flow

**Tests:**
- Component test: registration form validates inputs
- Component test: mnemonic dialog shows 12 words
- Component test: "Copy" button copies mnemonic to clipboard
- Component test: "I have stored my seed phrase" checkbox is required
- Component test: password strength indicator updates on input
- E2E: register → see mnemonic → acknowledge → redirect to dashboard

---

## Step 21 — Login Crypto Flow ✅

**Goal:** Wire up the full login flow: derive keys, unwrap, verify.

**Code:**
- Login crypto module (pure function, no side effects):
  - `deriveLoginKeys(passwordKey, wrappedMasterKey, masterKeyIV, serverFieldKeys): Promise<LoginResult>` — takes already-derived passwordKey (avoids double Argon2id), unwraps master key, derives KEK, unwraps field keys. Hex-decodes server field key data internally.
  - `LoginResult` type: `{ masterKey, kek (CryptoKey), fieldKeys (Map) }` — no authHash (caller already has it)
- Auth flow orchestration (in existing auth-flow module):
  - `loginUser(username, password)` — fetches salts via pre-auth RPC, derives credentials, authenticates, fetches key material, unwraps via `deriveLoginKeys`, populates crypto store with hex-encoded keys
  - `logoutUser` — calls `clearVault()` before resetting auth store
  - `subscribeToAuthChanges` — calls `clearVault()` when auth state becomes null (sign-out from another tab)
- Vault lock/unlock module:
  - `lockVault(): void` — delegates to crypto store's `lockVault()` (zeros keys, purges TanStack Query cache)
  - `unlockVault(password): Promise<void>` — fetches key material (user already authenticated), re-derives credentials, unwraps via `deriveLoginKeys`, populates crypto store
- Supabase data access module for keys:
  - `getLoginSalts(username): Promise<LoginSalts>` — calls SECURITY DEFINER RPC `get_login_salts` (pre-auth, rate-limited)
  - `getMasterKeyEnvelope(userId): Promise<ServerKeys>` — queries `keys` table (post-auth, RLS-protected)
  - `getFieldKeys(userId): Promise<ServerFieldKey[]>` — queries `field_keys` table
- Database migration: `get_login_salts(p_username)` RPC — SECURITY DEFINER, rate-limited (5 req/2 min/IP), case-insensitive username lookup joining `users` → `keys`
- Remove `derive-placeholder.ts` — replace with real login flow

**Key design decision:** Salts must be fetched before authentication (to derive authHash for Supabase Auth), but the `keys` table is RLS-protected. Solution: a `SECURITY DEFINER` RPC function that returns only `auth_salt` and `key_salt` (not wrapped key material) with rate limiting, callable by anonymous users.

**Tests:**
- Unit: `deriveLoginKeys` round-trip (register → wrap → unwrap → keys match)
- Unit: `deriveLoginKeys` with wrong passwordKey throws DecryptionError
- Unit: `deriveLoginKeys` with corrupted wrappedMasterKey throws
- Unit: `lockVault` zeros all keys in store
- Unit: `unlockVault` with valid password populates crypto store
- Unit: `unlockVault` without authenticated user throws
- Unit: `getLoginSalts`, `getMasterKeyEnvelope`, `getFieldKeys` server data access
- Unit: auth-flow `loginUser` calls correct sequence of operations
- Unit: auth-flow `logoutUser` calls `lockVault()` before resetting store

---

## Step 22 — Login UI + Vault Unlock ✅

**Goal:** Login page with vault unlock flow.

**Code:**
- Update LoginPage:
  - On submit: call `loginUser(username, password)` (already does full crypto flow — salts, auth, key unwrap, store population)
  - Show loading state during Argon2id derivation
  - On success: redirect to `/dashboard` (vault is already unlocked)
  - On error: show error message with i18n mapping (wrong password, salts not found, network error, corrupted data)
- `vault-dialog-store.ts` — separate Zustand store managing `isUnlockDialogOpen` state with `openUnlockDialog`/`closeUnlockDialog` actions. Decouples dialog visibility from vault lock state so the dialog can be opened/closed independently
- `VaultUnlockDialog`:
  - Modal dialog controlled by `useVaultDialogStore` (not by `isVaultLocked`). User can dismiss via `onOpenChange` which calls `closeUnlockDialog()`
  - Password input with react-hook-form + Zod validation + `unlockVault(password)` from vault-lock module
  - Error handling via `getCryptoErrorMessage` — maps `DecryptionError` → wrong password, `CorruptedDataError` → corrupted data, `Argon2Error` → derivation failed, network errors → network error, fallback → decrypt failed
  - Auto-focuses password input when dialog opens (`autoFocus` on Input)
  - Auto-closes dialog and resets form when vault transitions from locked → unlocked (uses `wasLockedRef` + `useEffect` watching `isVaultLocked`)
- `crypto-error-messages.ts` — maps crypto error types to i18n keys for vault unlock error display
- Sidebar/MobileNav lock button — calls `lockVault()` when vault is unlocked; unlock button calls `openUnlockDialog()` from `vault-dialog-store` (VaultUnlockDialog handles the actual unlock)
- `vault-timeout.ts` (`useVaultTimeout` hook):
  - Default 15-minute timeout (exported as `DEFAULT_VAULT_TIMEOUT_MS`)
  - Resets timer on user activity: `mousemove`, `keydown`, `mousedown`, `touchstart`, `scroll`
  - Does not start timer when vault is already locked
  - Calls `lockVault()` when timer expires
  - Cleans up all listeners and timer on unmount
- VaultUnlockDialog wired into ProtectedLayout alongside `useVaultTimeout()`
- `vault-lock.ts` — `lockVault()` zeros keys + sets `isVaultLocked` + purges query cache (preserves cached envelope); `clearVault()` zeros all state including cached envelope (used on logout); `unlockVault(password)` uses cached envelope when available (skips network calls), clears stale cache on `DecryptionError` and retries from server
- Remove `toggleVaultLock` TEMP action from crypto store (replaced by real `lockVault`/`unlockVault`)

**Tests:**
- Component test: vault unlock dialog appears when vault is locked
- Component test: vault unlock dialog does not render when vault is unlocked
- Component test: unlock calls `unlockVault` with password
- Component test: shows error on wrong password (DecryptionError)
- Component test: shows error on network error
- Component test: shows generic error on unexpected error
- Unit test: `useVaultTimeout` starts timer when unlocked, does not start when locked, resets on activity, calls `lockVault()` on timeout, cleans up on unmount
- Unit test: `getCryptoErrorMessage` maps all crypto error types correctly

---

## Step 23 — Non-Extractable Key Vault + Zustand Store Refactor ✅

**Goal:** Replace hex-encoded key strings in Zustand with a module-scoped `KeyVault` class holding non-extractable `CryptoKey` objects (so `exportKey()` fails). Consolidate vault lock/unlock logic, zero-fill intermediate key material, and remove the now-unnecessary `login.ts` and `vault-lock.ts` modules.

**Code:**
- Replace hex-encoded keys in crypto store (`masterKey`, `kek`, `fieldKeys`) with a `KeyVault` class (`key-vault.ts`) that stores non-extractable `CryptoKey` objects in a module-scoped `Map`. Crypto store now only tracks `loadedFieldKeys: Record<string, boolean>` (which field names are loaded, not the actual key bytes). Remove `selectFieldKey` — consumers call `keyVault.getKey(id)` instead
- `KeyVault.storeFieldKeys(kek, fieldKeys)` stores KEK + field CryptoKeys and calls `setKeys(fieldKeyNames)` on the Zustand store. `keyVault.lockVault()` clears the Map and sets `isVaultLocked`; `keyVault.clearVault()` additionally purges the cached envelope and query cache
- Move `unlockVault()` from `vault-lock.ts` into `auth-flow.ts`, inlining the derivation steps into focused helpers (`fetchFreshEnvelope`, `deriveKekFromEnvelope`, `storeFieldKeys`). Zero-fill all intermediate key material (`passwordKey`, `masterKey`, `kekBytes`) after use. On stale-cache `DecryptionError`, clear the vault and retry from server
- Delete `vault-lock.ts` and `login.ts` — their logic absorbed by `key-vault.ts` and `auth-flow.ts`. Update all callers (`Sidebar`, `MobileNav`, `VaultUnlockDialog`, `vault-timeout`) to use `keyVault.lockVault()` instead of the removed `lockVault()` function
- `generateFieldKeys()` now returns `{ rawFieldKeys, cryptoFieldKeys }` — raw bytes for wrapping, `CryptoKey` objects for encryption. `deriveFullKeyHierarchy` imports KEK as non-extractable (`extractable: false`). `unwrapFieldKeys` accepts `ServerFieldKey[]` directly and returns `Map<string, CryptoKey>`. `RegistrationResult` uses `CryptoKey` types for `kek` and `fieldKeys`; `masterKey` removed from the return type
- Simplify `split-kdf.ts`: remove `deriveLoginCredentials` and `LoginCredentials` type; `changePassword` reuses `deriveAuthCredentials` instead of a separate derivation path. `deriveAuthCredentials` returns `authHash` + `passwordKey` directly (login no longer needs both salts in one call since `authHash` is derived first, then `passwordKey` separately from the envelope's `keySalt`)
- Rename API fetchers: `getLoginSalts` → `fetchLoginSalts`, `getMasterKeyEnvelope` → `fetchMasterKeyEnvelope`, `getFieldKeys` → `fetchFieldKeys` (consistent verb convention). Update `IApiAdapter` interface accordingly
- Extend `zeroFill` in `crypto-utils.ts` to accept `Iterable<Uint8Array>` so you can zero-fill `rawFieldKeys.values()` in one call. Extract `HKDF_ALGORITHM` constant in `hkdf.ts` for DRY
- `clearVault()` in crypto store no longer calls `terminateWorker()` — worker termination moved to `logoutCleanup()` in `auth-flow.ts` alongside `keyVault.clearVault()` and `store.reset()`
- Verify `devtools` middleware is not in auth store or crypto store (secrets must not appear in browser DevTools). Verify no crypto keys appear in localStorage, sessionStorage, or IndexedDB. Verify `setQueryClient(client)` is wired in app providers

**Tests:**
- Unit: `KeyVault.storeFieldKeys` stores KEK and field keys, `getKey` retrieves them, `hasKey` checks existence
- Unit: `keyVault.lockVault()` clears vault Map, sets `isVaultLocked`, preserves cached envelope
- Unit: `keyVault.clearVault()` clears everything including cached envelope and purges query cache
- Unit: after `lockVault`/`clearVault`, `keyVault.getKey()` returns undefined and `loadedFieldKeys` is empty
- Unit: `generateFieldKeys` returns both raw and CryptoKey variants; CryptoKeys are non-extractable
- Unit: `unwrapFieldKeys` returns `Map<string, CryptoKey>` from `ServerFieldKey[]` input
- Unit: `zeroFill` handles single Uint8Array and iterable of Uint8Arrays
- Integration: `signUpUser` stores keys via `keyVault` and populates `loadedFieldKeys`
- Integration: `loginUser` → `unlockVault` → `lockVault` round-trip with cached envelope
- Security: verify crypto store never persists keys to storage; verify `exportKey()` fails on vault keys
