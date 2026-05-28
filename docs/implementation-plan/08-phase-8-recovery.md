# Phase 8: Password & Recovery

## Step 29 — Change Password Flow + UI

**Goal:** Change password without re-encrypting field data (only re-wrap master key).

**Code:**
- `src/features/settings/ui/ChangePasswordDialog.tsx`:
  - Current password input + new password input + confirm new password
  - Validation: new password must differ from current, confirm matches
  - On submit:
    1. Derive new auth credentials with new password
    2. Unwrap master key with old password key
    3. Re-wrap master key with new password key
    4. Upload new wrapped master key + new salts to server
    5. Update Supabase Auth password (new auth_hash)
    6. Update crypto store with new keys
  - Show success/error feedback
- Add i18n strings to `settings.json` for password change

**Tests:**
- Integration: change password → logout → login with new password → verify vault unlocks
- Integration: change password → old password no longer works
- Component test: form validation works
- Security test: field data is unchanged after password change (no re-encryption)

---

## Step 30 — Seed Phrase Backup View

**Goal:** Display stored seed phrase for backup (requires vault unlock).

**Code:**
- `src/features/settings/ui/SeedPhraseView.tsx`:
  - Requires vault to be unlocked
  - On "View Seed Phrase" click: fetch recovery data from server
  - Derive recovery KEK from stored mnemonic (or require user to re-enter password to access)
  - Display 12-word mnemonic in a `<Dialog>`
  - "Copy to clipboard" and "Download as text" buttons
  - Warning text about seed phrase security
  - Masked by default: click each word to reveal (or "Reveal all" button)
- `src/features/settings/ui/SeedPhraseWarning.tsx` — reusable warning component

**Tests:**
- Component test: seed phrase view requires vault unlock
- Component test: 12 words displayed correctly
- Component test: copy to clipboard works
- Component test: words are masked by default

---

## Step 31 — Seed Phrase Recovery Flow + UI

**Goal:** Recover account using seed phrase when password is lost.

**Code:**
- `src/pages/recover/RecoverPage.tsx`:
  - Username input + mnemonic input (12-word input with word-by-word validation)
  - On submit:
    1. Fetch recovery data (recovery_salt, wrapped_master_key, recovery_iv) from server for this username
    2. Derive recovery_KEK from mnemonic + recovery_salt
    3. Unwrap master key with recovery_KEK
    4. If successful: derive key hierarchy, unlock vault
    5. Prompt user to set a new password (required after recovery)
  - Error states: invalid mnemonic, wrong mnemonic for this account, network error
- `src/features/auth/ui/MnemonicInput.tsx`:
  - 12-word input with BIP-39 word validation
  - Auto-advance to next word on space/tab
  - Paste support (split pasted text into words)
  - Word validation against BIP-39 wordlist (highlight invalid words)
- After successful recovery, redirect to "Set New Password" flow (reuse ChangePasswordDialog logic)
- Add i18n strings to `auth.json` for recovery flow

**Tests:**
- Integration: register → write down mnemonic → recover with mnemonic → set new password → login with new password
- Component test: MnemonicInput validates BIP-39 words
- Component test: paste support splits text into 12 words
- Unit: wrong mnemonic → unwrap fails → error message
- Unit: recovery + new password → vault unlocks with new credentials

---

## Step 32 — Key Rotation + UI

**Goal:** Rotate individual field keys (re-encrypt one field's data without affecting others).

**Code:**
- `src/features/encryption/model/key-rotation.ts`:
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
- Add i18n strings to `settings.json` and `crypto.json`

**Tests:**
- Integration: rotate note key → verify note v2 in DB → verify note content decrypts correctly
- Integration: after rotation, old key can no longer decrypt (old ciphertext replaced)
- Integration: website and email field keys are unaffected by note key rotation
- Component test: key rotation section shows current versions
- Component test: confirmation dialog appears before rotation
- Unit: key version increments correctly
