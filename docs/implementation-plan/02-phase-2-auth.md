# Phase 2: Authentication ✅

## Step 6 — Supabase Auth Adapter + Username Auth ✅

**Goal:** Working auth adapter that maps username → Supabase email.

**Code:**
- Install `@supabase/supabase-js`
- Create `src/shared/auth/supabase-adapter.ts` implementing `IAuthAdapter`:
  - `login(username, authHash)` → maps `username` to `{username}@ciphernote.internal`, calls `supabase.auth.signInWithPassword`
  - `signup(username, authHash)` → maps email, calls `supabase.auth.signUp`, stores username in user metadata
  - `logout()` → calls `supabase.auth.signOut()`
  - `getSession()` → calls `supabase.auth.getSession()`
  - `recoverPassword()` → placeholder for seed phrase recovery
- Create `src/shared/auth/auth-context.tsx` — React context providing the auth adapter
- Create `src/shared/api/supabase-client.ts` — Supabase client initialization from env vars (combined with API adapter)
- Create `src/shared/auth/username-utils.ts` — `toSupabaseEmail(username)`, `fromSupabaseEmail(email)`
- Configure Supabase Auth to accept 64-character hex strings as passwords (disable default password complexity rules since the "password" is already an Argon2id hash)

**Tests:**
- Unit tests for `toSupabaseEmail` / `fromSupabaseEmail` (username → email mapping)
- Integration test: signup + login + logout flow against local Supabase
- Integration test: duplicate username returns error
- Integration test: wrong auth_hash returns error

---

## Step 7 — Auth UI: Register + Login Pages ✅

**Goal:** Working register and login pages with form validation and i18n.

**Code:**
- Register page (in `features/auth/ui/`):
  - Username input + password input + confirm password
  - react-hook-form + Zod schema validation (username pattern/length, password min length, confirm match)
  - On submit: call auth operations module to derive credentials and register
  - Show loading state during credential derivation
  - Error handling via error mapping module with toast notifications
- Login page (in `features/auth/ui/`):
  - Username input + password input
  - react-hook-form + Zod schema validation
  - On submit: call auth operations module to derive credentials and login
  - Redirect to `/dashboard` on success
  - Error handling via error mapping module with toast notifications
- Auth operations module (in `features/auth/model/`) — extracted async functions for register, login, logout: derive credentials via temporary placeholder, call auth adapter, update auth store
- Error mapping module (in `features/auth/model/`) — `AuthError` with `AuthErrorCode` enum (in `shared/auth/auth-errors.ts`), mapped to i18n keys by `getAuthErrorMessage` (in `features/auth/model/auth-error-messages.ts`)
- Shared form field component (in `features/auth/ui/`) — Label + children + error message
- AuthLayout — shared layout for auth pages (centered card)
- Zod schemas for registration and login forms
- Temporary crypto placeholder (in `shared/crypto/`) — SHA-256 derivation producing same output format as Argon2id (replace in Step 14)
- Add i18n strings to `auth.json` for both languages

**Tests:**
- Component tests: register and login pages render with all fields
- Component tests: validation errors shown for invalid input
- Component tests: submit button disabled during loading
- Component tests: error toast shown on auth failure
- Unit tests: auth operations module (register, login, logout)
- Unit tests: error mapping (AuthError codes → correct i18n keys, network error fallback, CryptoError fallback)
- Unit tests: credential derivation placeholder

---

## Step 8 — Auth State + Protected Routes ✅

**Goal:** Zustand auth store wired to Supabase Auth session. Protected routes redirect to login. Session survives page refresh.

**Code:**
- Auth store — add `isRestoringSession` state (defaults `true` on app boot), `setInitializing` action. `reset()` clears user/session/isLoading but does NOT touch `isRestoringSession` (logout should not re-trigger initialization)
- Auth adapter — add `onAuthStateChange(callback)` method to `IAuthAdapter`. Supabase adapter delegates to `supabase.auth.onAuthStateChange` (synchronous). Callback receives `AuthResult | null`
- Auth operations module — add `restoreSession()`: idempotent function that checks for existing session via `getSession()`, subscribes to auth state changes via `onAuthStateChange`, then sets `isRestoringSession = false`. The `onAuthStateChange` callback updates the store on auth events (token refresh, sign-out from other tabs). Returns unsubscribe function for cleanup
- App providers — block router mount with `PageSkeleton` while `isRestoringSession` is true. Call `restoreSession()` on mount and manage unsubscribe cleanup
- Auth context — expose `isRestoringSession` to React context and router guards
- `<RequireAuth>` component:
  - If initializing → show skeleton
  - If not authenticated → redirect to `/login`
  - If authenticated → render children
- `<GuestOnly>` component:
  - If initializing → show skeleton
  - If authenticated → redirect to `/dashboard`
  - If not authenticated → render children
- Wire auth state into router guards (route-level `beforeLoad` already handles redirects; components are defense-in-depth)

**Tests:**
- Unit tests: auth store transitions (unauthenticated → authenticated → unauthenticated)
- Unit tests: `isRestoringSession` state, `reset()` does not revert it
- Unit tests: `restoreSession` restores session, subscribes to changes, is idempotent
- Unit tests: `onAuthStateChange` callback updates store on auth result and null
- Unit tests: `requireAuth` redirects to `/login` when not authenticated
- Unit tests: `guestOnly` redirects to `/dashboard` when authenticated
- Unit tests: both components show skeleton when initializing
