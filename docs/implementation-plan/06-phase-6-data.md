# Phase 6: Encrypted Data Layer

## Step 24 — Supabase API Adapter

**Goal:** Full CRUD implementation for all database operations, split into focused modules.

**Code:**
- `src/shared/api/supabase-client.ts` — Supabase client initialization and export only (no business logic)
- `src/shared/api/supabase-keys.ts` — Keys CRUD:
  - `getMasterKeyEnvelope(userId: string): Promise<ServerKeys>` — fetch auth_salt, key_salt, wrapped_master_key, master_key_iv
  - `getFieldKeys(userId: string): Promise<ServerFieldKey[]>` — fetch all wrapped field keys with versions
  - `saveWrappedKey(userId: string, data: WrappedKeyData): Promise<void>` — save/update wrapped key data
- `src/shared/api/supabase-fields.ts` — Fields CRUD:
  - `getField(userId: string, fieldName: string): Promise<ServerEncryptedField | null>` — fetch encrypted field data
  - `saveField(userId: string, fieldName: string, blob: Uint8Array, iv: Uint8Array): Promise<void>` — upsert encrypted field
- `src/shared/api/supabase-recovery.ts` — Recovery data CRUD:
  - `saveRecoveryData(userId: string, data: RecoveryData): Promise<void>` — save recovery data
  - `getRecoveryData(userId: string): Promise<ServerRecoveryData | null>` — fetch recovery data
- All queries use Supabase client with RLS (user can only access own data)
- `ServerKeys`, `ServerFieldKey`, `ServerEncryptedField`, `ServerRecoveryData` types in api.types.ts

**Tests:**
- Integration tests against local Supabase:
  - Create user → save keys → fetch keys → verify match
  - Create user → save field → fetch field → verify match
  - Update field → fetch → verify updated
  - RLS: user A cannot read user B's data
  - RLS: unauthenticated user cannot read any data

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
