# Phase 7: Realtime & Multi-Device ✅

## Step 27 — Supabase Realtime Adapter ✅

**Goal:** Real-time sync when encrypted fields or entries are updated from another device or session.

**Code:**
- `src/shared/realtime/supabase-realtime.ts` implementing `IRealtimeAdapter`:
  - `subscribe(userId: string, callbacks: RealtimeCallbacks): Promise<void>`
    - Subscribe to `postgres_changes` on `encrypted_fields`, `entries`, and `field_keys` for this user
    - Realtime respects RLS — no per-channel filter needed (users only receive rows they can SELECT)
    - On field change: map snake_case row → camelCase `ServerEncryptedField`, call `callbacks.onFieldChange(fieldName, data)`; skip DELETE events (fields are cascade-deleted with entries)
    - On entry change: call `callbacks.onEntryChange({ eventType, entryId })` — entries carry no encrypted data, just metadata
    - On key rotation: call `callbacks.onKeyRotation(fieldName, newVersion)`; skip DELETE events (keys are versioned, never removed)
    - Surface `CHANNEL_ERROR` / `TIMED_OUT` via `callbacks.onError`; never reject or block the UI
  - `unsubscribe(): void` — remove the Supabase channel; idempotent
- `src/shared/realtime/realtime.types.ts` — `RealtimeCallbacks` includes:
  - `onFieldChange(fieldName, data)` — field row updated
  - `onEntryChange(change: RealtimeEntryChange)` — entry inserted/updated/deleted (for sidebar refresh)
  - `onKeyRotation(fieldName, newVersion)` — field key version bumped
  - `onError(error)` — transport errors
- `src/features/fields/model/use-realtime-sync.ts` — `useRealtimeSync` hook (mounted in `ProtectedLayout`):
  - Field change with no pending local save → invalidate field query → re-fetch → re-decrypt
  - Field change while a save mutation for the same `(entryId, fieldName)` is in-flight → conflict toast warning, skip invalidation (let the local save win)
  - Entry change → invalidate entry list query (sidebar refreshes)
  - Key rotation → info toast only (no key rotation producer exists yet; full re-fetch/re-unwrap is deferred to Step 28)
  - Errors are logged and swallowed (realtime is best-effort)
- `src/app/layouts/ProtectedLayout.tsx` — call `useRealtimeSync()` alongside `useVaultTimeout()`

**Tests:**
- Unit: `SupabaseRealtimeAdapter` — subscribe creates a per-user channel, maps field/entry/key-rotation payloads, skips DELETEs, surfaces errors, unsubscribe removes channel and is idempotent, re-subscribe tears down prior channel
- Unit: `useRealtimeSync` — subscribes on mount, unsubscribes on unmount, invalidates field query on remote change, shows conflict toast when a save is pending for the same field, invalidates entry list on entry change, shows info toast for key rotation, logs and swallows errors

---

## Step 28 — Multi-Device Session Handling ✅

**Goal:** Handle active sessions, key rotation, and remote conflicts across devices.

**Code:**
- `src/shared/crypto/key-vault.ts`: `syncFieldKeys` function to re-fetch and re-unwrap field keys.
- `src/features/fields/model/use-realtime-sync.ts`: 
  - `onKeyRotation`: apply rotation via `syncFieldKeys`.
  - `onFieldChange`: add "Use remote version" action to conflict toast.
- `src/features/fields/model/use-field.ts`: `useSaveField` locks vault on `DecryptionError`.
- Update i18n files for realtime conflict and rotation messages.

**Tests:**
- Unit: `key-rotation.test.ts` for re-derivation logic.
- Unit: `use-realtime-sync.test.ts` for rotation and conflict actions.
- Unit: `use-field.test.ts` for vault locking on decryption errors.

**Note:** Master key rotation (password change) is not synced in realtime because the new envelope requires the new password to unwrap. Instead, stale KEKs are detected via `DecryptionError`, triggering `lockVault()` and forcing re-authentication.
