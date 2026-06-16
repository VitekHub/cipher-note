# Phase 7: Realtime & Multi-Device

## Step 27 — Supabase Realtime Adapter

**Goal:** Real-time sync when encrypted fields are updated from another device or session.

**Code:**
- `src/shared/realtime/supabase-realtime.ts` implementing `IRealtimeAdapter`:
  - `subscribe(userId: string, callbacks: RealtimeCallbacks): Promise<void>`
    - Subscribe to `encrypted_fields` changes for this user
    - Subscribe to `field_keys` changes for this user (key rotation)
    - On change: call `callbacks.onFieldChange(fieldName, newData)`
    - On key rotation: call `callbacks.onKeyRotation(fieldName, newVersion)`
  - `unsubscribe(): void` — clean up subscriptions
- `src/features/fields/model/realtime-sync.ts`:
  - When field update comes from realtime: invalidate TanStack Query cache → re-fetch → re-decrypt
  - When key rotation event comes: invalidate field key cache → re-fetch wrapped key → re-unwrap with KEK (lives here, not in vault, to avoid cross-feature imports)
- Handle conflict: if local and remote both changed same field, show notification "Field updated remotely. Reload?"

**Tests:**
- Integration: update field on "device A" → "device B" receives realtime event → field updates
- Integration: key rotation on device A → device B receives event → field key updates
- Unit: `subscribe` sets up Supabase Realtime channel
- Unit: `unsubscribe` cleans up channel

---

## Step 28 — Multi-Device Session Handling

**Goal:** Handle multiple active sessions and key rotation across devices.

**Code:**
- `src/features/auth/model/session-sync.ts`:
  - When master key is rotated (password change on another device): force re-login
  - Session invalidation: if auth session expires, lock vault and redirect to login
- `src/features/fields/ui/ConflictNotification.tsx`:
  - Show toast notification when remote change conflicts with local edit
  - Options: "Keep mine" or "Use remote version"
- Handle Supabase Auth token refresh: auto-refresh JWT before expiry

**Tests:**
- Integration: password change on device A → device B detects session change → prompts re-login
- Unit: key rotation event → re-fetch field key → re-unwrap → success (in realtime-sync tests)
- Unit: session expiry → vault locks → redirect to login
