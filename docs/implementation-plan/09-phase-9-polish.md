# Phase 9: Polish

## Step 33 — Mobile Responsive Refinements

**Goal:** Ensure all pages work well on mobile viewports.

**Code:**
- Audit all pages on 375px (iPhone SE), 390px (iPhone 14), 768px (iPad):
  - Login/Register: stacked form, full-width inputs
  - Dashboard: stacked field cards (no sidebar), bottom navigation
  - Settings: stacked sections, full-width inputs
  - Mnemonic dialog: responsive 2→3 column grid on mobile, `break-words` for long mnemonics
  - Vault unlock dialog: full-screen on mobile
- Touch targets: mobile-first 44px minimum (`min-h-11` / `min-w-11`), reverting to standard sizes at `md:` breakpoint
- Keyboard handling: scroll to focused input on mobile
- Safe area insets: `viewport-fit=cover` meta + `env(safe-area-inset-top)` padding on headers
- Swipe gestures: consider swipe to lock vault on mobile

**Tests:**
- Visual/interaction test on each viewport size
- Verify no horizontal scroll on mobile
- Verify all touch targets meet minimum size
- Verify keyboard doesn't obscure active input

---

## Step 34 — Loading States, Error Boundaries, Toast Notifications

**Goal:** Professional UX for loading, errors, and notifications.

**Code:**
- Loading states:
  - Skeleton loaders for field content while fetching
  - Spinner during Argon2id derivation (login, register, password change)
  - Spinner during key wrapping/unwrapping operations
  - "Saving..." indicator on field auto-save
- Error boundaries (enhance the root error boundary from Step 3):
  - Crypto errors: "Decryption failed. Your data may be corrupted." with support link
  - Network errors: "Connection lost. Changes will sync when reconnected."
  - Route-level Suspense fallbacks already in place from Step 3
- Toast notifications:
  - Success: "Saved", "Password changed", "Key rotated"
  - Error: "Save failed — retrying", "Wrong password"
  - Warning: "Vault locked due to inactivity", "Remote change detected"
  - Use shadcn `Toaster` component
- i18n strings for all error/success messages

**Tests:**
- Component test: skeleton loaders shown during loading
- Component test: error boundary catches and displays error
- Component test: toast notifications appear for success/error
- Integration: network error → error toast → retry → success toast

---

## Step 35 — Security Hardening

**Goal:** Defense-in-depth security measures for an E2EE app.

**Code:**
- Memory safety:
  - Zero-fill all key material when vault is locked (already in crypto-store)
  - Zero-fill key material after use in crypto functions (best effort — JS GC is not guaranteed)
  - Avoid `string` for sensitive data where possible (use `Uint8Array`)
- CSP headers (in `vite.config.ts` or deployment config):
  - `Content-Security-Policy`: no inline scripts, no eval, strict origins
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: no-referrer`
- Supabase RLS audit:
  - Verify every table has RLS enabled
  - Verify policies enforce `user_id = auth.uid()` (using the internal Supabase email mapping)
  - Test that no table allows public read/write
- Input validation:
  - Username: alphanumeric + underscore, 3-32 characters
  - Password: minimum 8 characters (Argon2id handles the rest)
  - BIP-39 mnemonic: validate against wordlist before processing
- Session security:
  - Auto-lock vault after 15 minutes inactivity (configurable in settings)
  - Clear crypto store on page visibility change (tab switch) — optional, can be a setting
  - Supabase Auth token refresh handling

**Tests:**
- Security test: verify RLS blocks cross-user data access
- Security test: verify CSP headers are set
- Unit test: vault lock zeros all key material
- Unit test: input validation rejects malicious input (SQL injection in username, XSS in fields)
- Integration test: auto-lock triggers after timeout

---

## Step 36 — E2E Tests (Playwright)

**Goal:** Full end-to-end tests for critical user flows.

**Code:**
- `e2e/auth.spec.ts`:
  - Register new user → see mnemonic → acknowledge → redirect to dashboard
  - Login with correct password → unlock vault → see dashboard
  - Login with wrong password → error message
  - Logout → redirect to login
- `e2e/fields.spec.ts`:
  - Create note content → auto-save → refresh → content persists
  - Edit website field → save → verify encrypted data in DB
  - Edit all three fields → logout → login → all fields decrypt correctly
- `e2e/crypto.spec.ts`:
  - Change password → logout → login with new password → vault unlocks
  - Change password → old password fails
  - View seed phrase → copy → verify 12 words
  - Recover account with seed phrase → set new password → login
- `e2e/security.spec.ts`:
  - Register user A → verify user A cannot read user B's data (via API)
  - Verify encrypted fields in DB are not plaintext
  - Verify auth_hash in DB is not the real password
- `playwright.config.ts` — configure to run against local Supabase

**Tests:**
- All E2E tests pass
- Add to CI pipeline (optional, documented in README)
