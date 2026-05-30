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

## Step 25 — Encrypted Field CRUD

**Goal:** Encrypt/decrypt all three field types (note, website, email) end-to-end.

**Code:**
- `src/features/fields/model/field-crypto.ts`:
  - `encryptField(plaintext: string, fieldKey: Uint8Array): Promise<EncryptedFieldData>`
    - Convert string to Uint8Array (TextEncoder)
    - Generate random IV
    - Encrypt with AES-256-GCM using field key
    - Return `{ ciphertext: Uint8Array, iv: Uint8Array }`
  - `decryptField(encryptedData: EncryptedFieldData, fieldKey: Uint8Array): Promise<string>`
    - Decrypt with AES-256-GCM
    - Convert Uint8Array to string (TextDecoder)
    - Return plaintext string
- `src/features/fields/model/field-service.ts`:
  - `loadField(fieldName: string): Promise<string | null>` — fetch from server, decrypt, return plaintext
  - `saveField(fieldName: string, plaintext: string): Promise<void>` — encrypt, save to server
  - `loadAllFields(): Promise<Record<string, string | null>>` — load all three fields
- Wire into TanStack Query hooks:
  - `useField(fieldName)` — query + cache decrypted field content. **Must invalidate/purge this cache when vault is locked** (see Step 23).
  - `useSaveField(fieldName)` — mutation for saving field content
  - `useFieldKey(fieldName)` — get field key from crypto store (hex-decode from store before use)

**Tests:**
- Unit: encrypt then decrypt returns original string
- Unit: encrypt with different keys produces different ciphertext
- Unit: decrypt with wrong key throws
- Unit: `loadField` fetches, decrypts, returns plaintext
- Unit: `saveField` encrypts, uploads, returns success
- Integration: save field → load field → verify round-trip
- Integration: save all three fields → load all → verify round-trip

---

## Step 26 — Auto-Save + Sync Flow

**Goal:** Auto-save encrypted fields with debounce and optimistic updates.

**Code:**
- `src/features/fields/model/auto-save.ts`:
  - Debounced auto-save: 1-second debounce after user stops typing, using a proper debounce utility (not raw `setTimeout`). Consider `useDebouncedCallback` from `usehooks-ts` or a custom hook that cancels on unmount.
  - Optimistic update: update TanStack Query cache immediately, send to server in background
  - Revert on error: roll back TanStack Query cache if save fails
  - Save status indicator: "Saving...", "Saved", "Error — retry?"
- `src/features/fields/ui/SaveIndicator.tsx` — shows save status next to each field
- `src/features/fields/model/sync-status.ts` — Zustand store for sync status per field
- Handle concurrent edits: last-write-wins with version check

**Tests:**
- Unit: debounce doesn't trigger on rapid keystrokes
- Unit: optimistic update shows saved content immediately
- Unit: error reverts to previous content
- Component test: SaveIndicator shows correct states
- Integration: type content → auto-save → verify saved in Supabase
- Integration: type content → network error → retry → success
