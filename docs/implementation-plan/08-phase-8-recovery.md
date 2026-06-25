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

## Step 31 — Seed Phrase Recovery Flow + UI

**Goal:** Recover account using seed phrase when password is lost.

**Code:**
- `src/app/routes/_public.recover.tsx` — replace placeholder with full recovery form:
  - Username input + `MnemonicInput` (12-word input with BIP-39 validation)
  - On submit:
    1. Fetch recovery salts via `get_recovery_salts(p_username)` RPC (pre-auth, rate-limited)
    2. Derive recovery KEK from mnemonic + recovery salt via `deriveRecoveryKEK`
    3. Unwrap master key with `unwrapMasterKeyWithRecovery`
    4. Derive full key hierarchy, unlock vault
    5. Prompt user to set a new password (required — old auth hash is invalid after recovery)
  - Error states: invalid mnemonic (BIP-39 validation), wrong mnemonic (DecryptionError), network error
- `src/features/auth/ui/MnemonicInput.tsx`:
  - 12 individual word inputs with BIP-39 word validation
  - Auto-advance to next word on space/tab; paste support (split pasted text into words)
  - Highlight invalid words in red; disable submit until all 12 words are valid BIP-39 words
- `src/features/auth/ui/VerifyMnemonicDialog.tsx`:
  - From SecuritySection, let user verify their stored mnemonic can unwrap the master key
  - Uses `MnemonicInput` → derive recovery KEK → `unwrapMasterKeyWithRecovery` with cached envelope
  - Success: "Your recovery phrase is valid" / Failure: "Recovery phrase does not match"
- `src/features/auth/model/recovery-service.ts`:
  - Orchestrates: fetch salts → derive KEK → unwrap master key → derive key hierarchy → set new password
  - Reuses `deriveFullKeyHierarchy` and password-setting logic from `changeUserPassword`
- `src/shared/api/supabase-recovery.ts` — add `get_recovery_salts(p_username)` RPC call for pre-auth salt fetch
- Add i18n strings to `auth.json` for recovery flow

**Tests:**
- Integration: register → write down mnemonic → recover with mnemonic → set new password → login with new password
- Component: MnemonicInput validates BIP-39 words, highlights invalid, supports paste
- Unit: wrong mnemonic → `unwrapMasterKeyWithRecovery` throws `DecryptionError`
- Unit: recovery + new password → vault unlocks with new credentials
- Component: VerifyMnemonicDialog shows success/failure based on mnemonic validity

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
