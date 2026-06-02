# Phase 6: Encrypted Data Layer

## Step 24 — Supabase API Adapter ✅

**Goal:** Full CRUD implementation for all database operations, split into focused modules.

**Code:**
- `src/shared/api/api-errors.ts` — `ApiError` class + `ApiErrorCode` (`NETWORK_ERROR`, `NOT_FOUND`, `UNEXPECTED`), `isApiError()` type guard, `wrapApiError()` (reuses `isNetworkError` from auth-errors)
- `src/shared/api/supabase-keys.ts` — Keys CRUD:
  - `fetchMasterKeyEnvelope(userId)` — now throws `ApiError(NOT_FOUND)` instead of `AuthError(KEYS_NOT_FOUND)`
  - `fetchFieldKeys(userId)` — same error refactor
  - `saveWrappedKey(userId, data: SaveWrappedKeyData)` — upsert on `field_keys` with `onConflict: 'user_id,field_name,version'`
  - `fetchLoginSalts` stays with `AuthError` (pre-auth, not an IApiAdapter method); local error helper renamed to `wrapAuthError`
- `src/shared/api/supabase-fields.ts` — Fields CRUD:
  - `fetchField(userId, fieldName)` — `.maybeSingle()` on `encrypted_fields`, returns `null` if missing, maps snake_case → camelCase
  - `saveField(userId, fieldName, data: SaveFieldData)` — `.upsert()` with `onConflict: 'user_id,field_name'`
- `src/shared/api/supabase-recovery.ts` — Recovery data CRUD:
  - `fetchRecoveryData(userId)` — `.maybeSingle()` on `recovery`, returns `null` if missing
  - `saveRecoveryData(userId, data: SaveRecoveryData)` — `.upsert()` with `onConflict: 'user_id'`
- All data flows as hex strings in the API layer — no Uint8Array conversion at this boundary
- Remove `KEYS_NOT_FOUND` from `AuthErrorCode`; update `auth-error-messages.ts` to handle `ApiError` codes
- Update `IApiAdapter` interface: rename `getField` → `fetchField`, `getRecoveryData` → `fetchRecoveryData`

**Tests:**
- Unit tests with mocked Supabase client for all CRUD functions
- `api-errors.test.ts` — construction, type guard, `wrapApiError` mapping
- Error assertions: `ApiError(NOT_FOUND)` for missing data, `ApiError(UNEXPECTED)` for query failures

---

## Step 25 — Encrypted Field CRUD ✅

**Goal:** Encrypt/decrypt all three field types (note, website, email) end-to-end.

**Code:**
- `src/features/fields/model/field-crypto.ts`:
  - `encryptField(plaintext: string, fieldKey: CryptoKey, fieldName: FieldName): Promise<EncryptedFieldData>`
    - Convert string to Uint8Array (TextEncoder)
    - Generate random IV
    - Encrypt with AES-256-GCM using non-extractable CryptoKey from KeyVault
    - Bind ciphertext to field name + key version via AAD (prevents ciphertext swapping between fields)
    - Return `{ ciphertext: Uint8Array, iv: Uint8Array }`
  - `decryptField(encryptedData: EncryptedFieldData, fieldKey: CryptoKey, fieldName: FieldName): Promise<string>`
    - Decrypt with AES-256-GCM, reconstructing AAD from fieldName + version
    - Convert Uint8Array to string (TextDecoder)
    - Return plaintext string
  - `toSaveFieldData(encryptedData)` — convert binary `EncryptedFieldData` to hex-string `SaveFieldData` for the API
  - `toEncryptedFieldData(serverField)` — convert hex-string `ServerEncryptedField` from the API to binary `EncryptedFieldData`
- `src/features/fields/model/field-service.ts`:
  - `FieldService` class (singleton `fieldService`) encapsulating auth + key vault access:
    - `loadField(fieldName): Promise<string | null>` — fetch from server, decrypt, return plaintext
    - `saveField(fieldName, plaintext): Promise<void>` — encrypt, save to server
    - `loadAllFields(): Promise<Record<string, string | null>>` — load all three fields in parallel
  - Gets user ID from auth store, gets CryptoKey from KeyVault (no separate hook needed)
- Wire into TanStack Query hooks:
  - `useField(fieldName)` — query + cache decrypted field content, disabled while vault locked or field key not loaded
  - `useSaveField(fieldName)` — mutation for saving field content, invalidates field query on success
- `src/shared/types/entities/field.types.ts`:
  - `FieldName` type (`'note' | 'website' | 'email'`), `FIELD_NAMES` canonical list
  - `EncryptedField` and `DecryptedField` interfaces for server/client representations

**Tests:**
- Unit: encrypt then decrypt returns original string
- Unit: encrypt with different keys produces different ciphertext
- Unit: decrypt with wrong key throws
- Unit: `loadField` fetches, decrypts, returns plaintext
- Unit: `saveField` encrypts, uploads, returns success
- Integration: save field → load field → verify round-trip
- Integration: save all three fields → load all → verify round-trip

---

## Step 26 — Auto-Save + Sync Flow ✅

**Goal:** Auto-save encrypted fields with debounce and local draft pattern.

**Code:**
- Auto-save hook:
  - Debounced save: 1-second debounce after user stops typing, using `setTimeout` with refs to avoid stale closures (ref to latest mutation function, ref to latest value). Clear timeouts on unmount and on vault lock.
  - Local draft pattern: instead of mutating the TanStack Query cache, maintain a local `draft` state that takes priority over query data while the user is editing. When not editing, fall back to query data. This avoids cache-invalidation race conditions in text editors.
  - Preserve draft on error: on save failure, keep the draft content and set sync status to `error`. Provide a `retry()` function that re-submits the latest draft immediately (no debounce). Do not roll back to stale server data.
  - "Saved" auto-dismiss: transition from `saved` → `idle` after 3 seconds so the check mark doesn't persist forever.
  - Vault lock handling: clear debounce/saved timers and reset editing state on vault lock; return empty string as value since query cache is purged.
- Save indicator component — renders nothing for `idle`, spinner + "Saving..." for `saving`, check + "Saved" for `saved`, error icon + "Save failed" + "Retry" button for `error`. Uses static i18n key map so i18next-parser can discover the strings.
- Sync status Zustand store — `Record<FieldName, SyncStatus>` with `setStatus`, `resetField`, `resetAll` actions. Uses devtools middleware. `SyncStatus` type: `'idle' | 'saving' | 'saved' | 'error'`.

**Tests:**
- Unit: debounce cancels earlier timers — rapid `setValue` calls trigger only one save
- Unit: local draft updates immediately on `setValue` (optimistic display)
- Unit: error preserves draft content and sets status to `error`; `retry` resubmits without debounce
- Unit: vault lock resets editing state and clears timers
- Component test: SaveIndicator renders correct UI for each status, including retry button
- Unit: sync status store transitions through full lifecycle and resets
