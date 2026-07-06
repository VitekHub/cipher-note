# Phase 8: Password & Recovery

## Step 29 — Change Password Flow + UI ✅

**Goal:** Change password without re-encrypting field data (only re-wrap master key).

**Code:**
- Validate `changePassword` pure crypto function in split-kdf module:
  - Derive old password key from existing `keySalt`, unwrap master key
  - Generate fresh `authSalt` and `keySalt`, derive new credentials via `deriveAuthCredentials`
  - Re-wrap master key with new password key, return new auth hash + salts + wrapped master key + IV
  - Zero out sensitive intermediate values
- `src/features/auth/ui/ChangePasswordDialog.tsx`:
  - Current password input + new password input (with password strength) + confirm new password
  - Zod schema validation: required fields, min length, new password must differ from current, passwords must match
  - On submit — 4-step orchestration:
    1. Call pure crypto function to derive new credentials
    2. Upload new key envelope to server
    3. Update Supabase Auth password (new auth_hash)
    4. Update cached envelope in crypto store
  - Rollback: if step 3 fails after step 2 succeeds, attempt DB rollback with old envelope values; if rollback also fails, force logout
  - Error mapping: `DecryptionError` → incorrect password, `AuthErrorCode` / `ApiErrorCode` → appropriate messages, network error fallback
  - Show toast notifications for success/error feedback
- `change-password-dialog-store.ts` — Zustand store for dialog open/close state (rendered at app layout level, triggered from SecuritySection)
- Add i18n strings to `auth.json` (not `settings.json` — this is an auth feature)

**Tests:**
- Integration: change password → old password can no longer unwrap master key; field keys still decrypt unchanged data
- Component test: form validation rejects mismatched/empty/too-short passwords

---

## Step 30 — Regenerate Seed Phrase ✅

**Goal:** Regenerate seed phrase (requires the user to enter the password again).

**Code:**
- `src/features/settings/ui/SecuritySection.tsx`:
  - Change "Seed phrase" item from static text to clickable → opens `RegenerateMnemonicDialog`
- `src/features/auth/ui/RegenerateMnemonicDialog.tsx`:
  - Reuse `PasswordConfirmDialog` component for password entry
  - On password confirm → call orchestration service, then display mnemonic in `<MnemonicDialog>` (reuse from registration)
  - On MnemonicDialog continue → show success toast and close
  - Error mapping delegated to a dedicated error-mapping module
- Pure crypto function in `mnemonic.ts`: `regenerateRecoveryData(password, envelope)`:
  - Derive passwordKey from password + envelope keySalt, unwrap master key
  - Generate fresh mnemonic, recoverySalt, recoveryIV
  - Wrap master key with new recovery KEK via `wrapMasterKeyWithRecovery`
  - Zero out passwordKey and masterKey after use
  - Returns `{ mnemonic, recoveryData }`
- Orchestration service in `features/auth/model/`: calls `regenerateRecoveryData`, then `saveRecoveryData` to server
  - Uses cached envelope from crypto store, falls back to fresh fetch
  - No rollback needed — if save fails, old recovery data remains valid
- Dialog store in `shared/auth/` — Zustand store for dialog open/close state (with devtools, no sensitive data)
- Dedicated error-mapping module: maps `DecryptionError`, `AuthError`, `ApiError`, and network errors to i18n strings
- Add i18n strings to `auth.json`

**Tests:**
- Integration: regenerate mnemonic → old mnemonic can no longer unwrap master key, new mnemonic can
- Component: RegenerateMnemonicDialog rejects wrong password, shows MnemonicDialog on success
- Unit: `regenerateRecoveryData` with new salt/IV produces different wrapped key than original
- Unit: error-mapping module covers all error types

---

## Step 31 — Seed Phrase Recovery Flow + UI ✅

**Goal:** Recover account using seed phrase when password is lost.

**Code:**
- `src/app/routes/_public.recover.tsx` — route renders `RecoverPage` component
- `src/features/auth/ui/RecoverPage.tsx` — two-step form (mnemonic → new password):
  - Step 1: username input + `MnemonicInput`; calls `recoveryFlow.validateMnemonic()`
  - Step 2: new password + confirm; calls `recoveryFlow.setNewPassword()`
  - On success, navigates to `/dashboard`; on `RecoveryLoginError`, navigates to `/login` with toast
  - Zero-fills recovery state on unmount via `recoveryFlow.clear()`
- `src/features/auth/ui/MnemonicInput.tsx`:
  - Controlled component with `value`, `onChange`, `onValidityChange` props
  - 12 individual word inputs with BIP-39 word validation (async via `getBip39Wordlist()`)
  - Auto-advance on space/tab; paste support (multi-word paste splits into inputs)
  - Invalid words highlighted with `border-destructive`; submit disabled until all valid
- `src/features/auth/ui/VerifyMnemonicDialog.tsx`:
  - From SecuritySection, verify mnemonic can unwrap the master key
  - Uses `verifyMnemonic()` from `mnemonic-service.ts` → returns true/false
  - Success toast / failure error message
- `src/features/auth/model/mnemonic-service.ts` — `RecoveryFlow` class:
  - `validateMnemonic(username, mnemonic)` → fetches recovery data pre-auth, unwraps master key, stores state
  - `setNewPassword(newPassword)` → re-wraps master key, calls `recoverAccount` RPC, logs in, unlocks vault
  - `clear()` → zero-fills master key and clears state
  - `RecoveryLoginError` thrown when recovery succeeds but auto-login fails
  - `verifyMnemonic(mnemonic)` → standalone function for verifying mnemonic from SecuritySection
- `src/features/auth/model/recovery-schema.ts` — Zod schemas for both steps
- `src/features/auth/model/recovery-error-messages.ts` — error mapping for recovery + regenerate mnemonic flows
- `src/shared/api/supabase-recovery.ts` — three RPCs:
  - `fetchRecoveryDataPreAuth(username)` — `get_recovery_data` RPC (pre-auth, rate-limited 5 req/2 min/IP)
  - `recoverAccount(username, data)` — `recover_account` RPC (atomic: verify proof + update auth/salts/keys, rate-limited 3 req/15 min/IP)
  - `saveRecoveryData` — changed from direct table insert to `save_recovery_data` RPC (bcrypt-hashes `recoveryAuthHash`)
- `supabase/migrations/00006_recovery_rpc.sql` — migration with all three RPCs
- Recovery uses `recoveryAuthHash` (HKDF of recovery KEK) as proof-of-knowledge:
  - `wrapMasterKeyWithRecovery` and `unwrapMasterKeyWithRecovery` now return `recoveryAuthHash`
  - Server stores bcrypt hash of `recoveryAuthHash`; `recover_account` verifies it before updating
  - `RecoveryCredentials` type: `{newPasswordAuthHash, newKeySalt}` (no `mnemonic` field)
- `src/shared/ui/create-dialog-store.ts` — factory for simple open/close dialog stores
- `src/shared/auth/auth-dialogs-store.ts` — consolidated auth dialog stores using factory
- Dialog stores refactored: `change-password-dialog-store`, `regenerate-mnemonic-dialog-store`, `vault-dialog-store` → use `createDialogStore` with `isOpen/open/close` API
- Login page: "Forgot password?" link to `/recover`
- Add i18n strings to `auth.json` (recovery, verify mnemonic) and `settings.json` (verify seed phrase)

**Tests:**
- Integration: register → recover with mnemonic → set new password → login with new password
- Component: MnemonicInput validates BIP-39 words, highlights invalid, supports paste
- Unit: wrong mnemonic → `unwrapMasterKeyWithRecovery` throws `DecryptionError`
- Unit: `RecoveryFlow` class — validate mnemonic, set new password, clear
- Component: VerifyMnemonicDialog shows success/failure based on mnemonic validity
- Component: RecoverPage — step transitions, error handling
- Unit: `recovery-schema` validation
- Unit: `recovery-error-messages` covers all error types
- Unit: `getBip39Wordlist()` caching, HKDF `RECOVERY_AUTH` branch

---

## Step 32 — Key Rotation + UI

**Goal:** Rotate individual field keys (re-encrypt one field's data without affecting others).

**Code:**
- `src/shared/crypto/key-rotation.ts`:
  - `rotateFieldKey(fieldName: string): Promise<void>`
    1. Generate new random 256-bit field key
    2. Increment version for this field (v1 → v2)
    3. Wrap new field key with KEK (AAD = fieldName + newVersion)
    4. Decrypt current field content with old field key
    5. Re-encrypt field content with new field key
    6. Upload new wrapped field key + new encrypted field content to server
    7. Update crypto store with new field key
    8. Old wrapped key and old ciphertext are replaced on server
- `src/features/settings/ui/KeyRotationSection.tsx`:
  - Shows current key versions for each field (note v1, website v1, email v1)
  - "Rotate key" button for each field
  - Confirmation dialog: "This will re-encrypt your [field name] data. This cannot be undone."
  - Success/error feedback
- Add i18n strings to `settings.json` and `vault.json`

**Tests:**
- Integration: rotate note key → verify note v2 in DB → verify note content decrypts correctly
- Integration: after rotation, old key can no longer decrypt (old ciphertext replaced)
- Integration: website and email field keys are unaffected by note key rotation
- Component test: key rotation section shows current versions
- Component test: confirmation dialog appears before rotation
- Unit: key version increments correctly
