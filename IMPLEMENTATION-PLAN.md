# Cipher Note React — Implementation Plan

## App Summary

Cipher Note is an end-to-end encrypted (E2EE) note-taking app where the server never sees plaintext data. Each user has three encrypted fields — note, website, email — protected by a layered key hierarchy. The password never leaves the client; instead, an Argon2id-derived hash authenticates with Supabase Auth. A 12-word BIP-39 seed phrase allows account recovery if the password is lost. The app is built as a responsive SPA with dark theme default.

## No Backward Compatibility

This app will never need backward compatibility with previous versions. The database is always reset on changes. Do not add migration paths, version checks, or compatibility shims for old data formats.

## Decisions Summary

| Decision | Choice |
|----------|--------|
| Key hierarchy | 3-layer with KEK (random field keys, versioned, wrapped) |
| Zero-knowledge auth | Split KDF (ProtonMail pattern) — integrates with Supabase Auth |
| Key wrapping | AES-256-GCM |
| Seed phrase recovery | BIP-39 mnemonic wrapping master key |
| Encryption parameters | AES-256-GCM, Argon2id (m=47104, t=3, p=1), HKDF-SHA-256 |
| Backend & database | Supabase (local Docker for dev) |
| Frontend stack | Vite + Zustand + TanStack Query/Router + react-i18next + shadcn/ui + Tailwind |
| Route structure | TanStack Router file-based routes in `src/app/routes/` (no separate `pages/` dir) |
| Crypto key storage | Zustand store with hex-encoded strings (not Uint8Array/Map) — proper reactivity |
| Code splitting | argon2-browser WASM + @scure/bip39 lazy-loaded via dynamic import + Web Worker |
| Vault lock security | Purges TanStack Query cache of decrypted field data on lock |
| Crypto libraries | Web Crypto API + argon2-browser + @scure/bip39 |
| Component library | shadcn/ui + Tailwind, dark theme default |
| Auth | Username only, no email, no email verification |
| Layout | Responsive / mobile-friendly from day 1 |
| i18n | English (default) + Czech |
| Testing | Tests alongside code in every step |

---

## Key Architecture Notes

### Auth: Username → Supabase Email Mapping

Supabase Auth requires an email field, but this app uses username only. The mapping:

```
username → `{username}@ciphernote.internal`
```

The user never sees this email. The app stores the real username in `auth.users.raw_user_meta_data` and displays it in the UI. The `auth_hash` (derived from the password via Argon2id) is sent as the Supabase Auth "password" — Supabase never sees the real password.

### Crypto Session (Vault)

When the user logs in and unlocks their vault, the Master Key, KEK, and field keys live in a Zustand store (memory only — never persisted). When the vault is locked, all keys are zeroed from memory. This Zustand store has no `persist` middleware — keys exist only while the session is active.

### Adapter Pattern

All backend-specific code lives behind interfaces in `shared/`. Features import interface types, never implementations directly. Swapping backends means writing new adapters, not rewriting features.

- `shared/auth/` — Auth interface (`login`, `logout`, `getSession`, `signup`, `recoverPassword`). Supabase Auth adapter today; custom JWT or OPAQUE adapter later.
- `shared/api/` — Data access interface (`getKeys`, `saveField`, `getField`, etc.). Supabase client queries today; REST calls to Hono API later.
- `shared/realtime/` — Realtime interface (`subscribe`, `unsubscribe`, `onFieldChange`). Supabase Realtime today; raw WebSocket to Hono server later.

---

## Project Structure

```
cipher-note-react/
  src/
    app/
      Providers.tsx            # QueryClientProvider, i18n, AuthProvider
      router.tsx               # TanStack Router route tree
      ErrorBoundary.tsx       # Root error boundary with crypto error handling
      styles/
        globals.css            # Tailwind directives + shadcn CSS variables
      layouts/
        PublicLayout.tsx        # Centered card layout for auth pages
        ProtectedLayout.tsx     # Sidebar + header + main content
      routes/
        __root.tsx              # Root route with providers + Suspense boundary
        login.tsx               # /login route (lazy-loaded)
        register.tsx            # /register route (lazy-loaded)
        recover.tsx             # /recover route (lazy-loaded)
        dashboard.tsx           # /dashboard route (lazy-loaded, protected)
        settings.tsx            # /settings route (lazy-loaded, protected)
    features/
      auth/
        model/
          auth-store.ts        # Zustand: session, user, isAuthenticated
          register-schema.ts   # Zod validation
          login-schema.ts      # Zod validation
        ui/
          AuthLayout.tsx       # Shared layout for auth pages
          MnemonicDialog.tsx   # Seed phrase display
          MnemonicInput.tsx    # 12-word input with BIP-39 validation
          PasswordStrength.tsx # Password strength indicator
        lib/
          RequireAuth.tsx      # Redirect to /login if not authenticated
          GuestOnly.tsx        # Redirect to /dashboard if authenticated
      fields/
        model/
          field-crypto.ts      # encrypt/decrypt field content
          field-service.ts     # load/save fields via API
          auto-save.ts         # Debounced auto-save with optimistic updates
          sync-status.ts       # Zustand: per-field sync status
        ui/
          FieldCard.tsx        # Locked/unlocked field display
          NoteField.tsx        # Textarea for note content
          WebsiteField.tsx     # Input for website URL
          EmailField.tsx       # Input for email address
          SaveIndicator.tsx    # "Saving..." / "Saved" / "Error"
          ConflictNotification.tsx
      encryption/
        model/
          crypto-store.ts      # Zustand: masterKey, KEK, fieldKeys (memory only, hex strings)
          registration.ts      # Full registration crypto flow
          login.ts             # Full login crypto flow
          vault-lock.ts        # Lock/unlock vault operations + query cache purge
          vault-timeout.ts     # Auto-lock after inactivity
          key-rotation.ts      # Rotate individual field keys
          multi-device.ts      # Handle key changes from other sessions
          upload-keys.ts       # Upload wrapped keys to server
          encryption-facade.ts # Thin public API for other features to call
        ui/
          VaultUnlockDialog.tsx
          VaultIndicator.tsx
      settings/
        ui/
          SecuritySection.tsx  # Change password, seed phrase, key versions
          PreferencesSection.tsx  # Language switcher
          AccountSection.tsx   # Username, delete account
          ChangePasswordDialog.tsx
          SeedPhraseView.tsx
          SeedPhraseWarning.tsx
          KeyRotationSection.tsx
    shared/
      ui/
        brand/
          AppLogo.tsx
          CipherNoteIcon.tsx
        nav/
          NavLink.tsx
          LanguageSwitcher.tsx
          MobileNav.tsx
          Sidebar.tsx
          ResizeHandle.tsx
        form/
          FormField.tsx
        button.tsx              # shadcn/ui components — NO index.ts barrel file
        input.tsx
        card.tsx
        dialog.tsx
        toast.tsx
        # etc. — each shadcn component in its own file, imported directly
      crypto/
        aes-gcm.ts            # AES-256-GCM encrypt/decrypt/importKey/exportKey
        key-wrap.ts           # Key wrapping/unwrapping with AAD
        argon2id.ts           # Argon2id derivation via argon2-browser (WASM, lazy-loaded)
        hkdf.ts               # HKDF-SHA-256 sub-key derivation
        key-hierarchy.ts     # Master key → KEK → field keys orchestration
        split-kdf.ts          # Split KDF (auth + key derivation from password)
        mnemonic.ts           # BIP-39 generate/validate/wrap/unwrap (lazy-loaded)
        memory.ts             # zeroFill, copyToUint8Array
      api/
        api.types.ts          # IApiAdapter interface
        supabase-client.ts    # Supabase client initialization only
        supabase-keys.ts      # Keys CRUD (getKeys, getFieldKeys, saveWrappedKey)
        supabase-fields.ts    # Fields CRUD (getField, saveField)
        supabase-recovery.ts  # Recovery data CRUD (saveRecoveryData, getRecoveryData)
        # future: hono-client.ts
      auth/
        auth.types.ts         # IAuthAdapter interface
        supabase-adapter.ts   # Supabase Auth implementation
        auth-context.tsx       # React context for auth adapter
        username-utils.ts     # toSupabaseEmail, fromSupabaseEmail
        # future: custom-jwt-adapter.ts, opaque-adapter.ts
      realtime/
        realtime.types.ts     # IRealtimeAdapter interface
        supabase-realtime.ts  # Supabase Realtime implementation
        # future: ws-realtime.ts
      i18n/
        config.ts             # i18next init + language detector + http backend
        locales/
          en/
            common.json
            auth.json
            fields.json
            settings.json
            crypto.json
          cs/
            common.json
            auth.json
            fields.json
            settings.json
            crypto.json
      types/
        crypto.types.ts       # WrappedKey, FieldKey, EncryptedField, etc.
        api.types.ts          # ServerKeys, ServerFieldKey, etc.
        entities/
          user.types.ts       # User entity types
          field.types.ts      # Field entity types
          key.types.ts        # Key entity types
    e2e/
      auth.spec.ts
      fields.spec.ts
      crypto.spec.ts
      security.spec.ts
  supabase/
    config.toml
    migrations/
      00001_create_tables.sql
      00002_rls_policies.sql
      00003_functions.sql
    seed.sql
  package.json
  vite.config.ts
  tailwind.config.ts
  tsconfig.json
  playwright.config.ts
  .env.local.example
```

Dependency rules: `routes` → `features` → `shared`. No cross-feature imports. If `features/fields` needs to call encryption logic, it must import from `features/encryption/model/encryption-facade.ts` (a thin public API), never from `features/encryption/model/vault-lock.ts` or other internal modules.

### File Size and Organization Rules

- **Keep files small.** Target 100–200 lines per file. If a file exceeds 300 lines, split it. A 500-line file is a code smell — split it immediately.
- **Prefer deep folder hierarchies over wide shallow files.** A path like `features/encryption/model/key-rotation.ts` is better than a 400-line `features/encryption/crypto.ts` that does everything.
- **One responsibility per file.** `aes-gcm.ts` does AES-GCM only. `argon2id.ts` does Argon2id only. `key-hierarchy.ts` orchestrates them. Don't mix concerns.
- **Types in separate `.types.ts` files.** Keep type definitions separate from implementation. A consumer should import types without pulling in crypto dependencies.
- **Each test file mirrors its source.** `aes-gcm.ts` → `aes-gcm.test.ts` in the same directory. No separate `__tests__` folders — colocate tests with the code they test.
- **No barrel files (index.ts).** Import components directly by path: `import { Button } from '@/shared/ui/button'` not `import { Button } from '@/shared/ui'`. Barrel files defeat tree-shaking and cause the entire module graph to be analyzed even when only one export is needed. This applies to all directories — `shared/ui/`, `shared/crypto/`, `shared/auth/`, etc.
- **File naming convention.** Component files (`.tsx` exporting a React component) use PascalCase: `LoginPage.tsx`, `FormField.tsx`. Non-component files use kebab-case: `auth-store.ts`, `login-schema.ts`. Exceptions: shadcn/ui primitives stay kebab-case (`button.tsx`, `input.tsx`), context/provider modules that export both component and hook stay kebab-case (`auth-context.tsx`, `theme-provider.tsx`), and route files follow TanStack Router convention.
- **Lazy-load heavy crypto modules.** `argon2-browser` (WASM, ~200KB+) and `@scure/bip39` (2048-word dictionary) must be dynamically imported via `await import(...)` only when the user is actually authenticating or recovering. Never import them at the top level of a module that loads on app startup.

---

## Phase 1: Project Foundation

### Step 1 — Project Scaffolding + UI Foundation ✅

**Goal:** Working Vite + React app with Tailwind, shadcn/ui, and dark mode.

**Code:**
- `pnpm create vite` with React + TypeScript template
- Install and configure Tailwind CSS v4
- Initialize shadcn/ui (components.json, dark theme default, CSS variables)
- Install base shadcn components: `Button`, `Input`, `Label`, `Card`, `Dialog`, `Sonner`
- Set up `src/shared/ui/` as the component library location — **each shadcn component in its own file, NO `index.ts` barrel file** (import directly: `import { Button } from '@/shared/ui/button'`)
- Configure dark mode as default via `class="dark"` on `<html>` and ThemeProvider context
- Create `src/app/styles/globals.css` with Tailwind v4 directives (`@import "tailwindcss"`, `@custom-variant dark`, `@theme inline`) + shadcn CSS variables
- Create `ThemeProvider` component in `src/shared/lib/theme-provider.tsx` (defaults to dark, persists to localStorage)
- Create base `AppLayout` component with dark theme
- Configure Vite code splitting: `argon2-browser` → `crypto-argon2` chunk, `@scure/bip39` → `crypto-bip39` chunk via `manualChunks`
- Set up ESLint with `eslint-config-prettier` to disable conflicting formatting rules; configure `react-refresh/only-export-components` rule to allow constant exports (`allowConstantExport: true`), named exports for `useTheme` and `buttonVariants` (`allowExportNames`), and disable the rule for `src/test/**` files
- Set up Prettier with `prettier-plugin-tailwindcss` for deterministic class sorting, single quotes, trailing commas, no semicolons

**Tests:**
- Verify `render(<App />)` shows the app with dark background
- Verify shadcn `Button` renders correctly

---

### Step 2 — i18n Setup ✅

**Goal:** react-i18next working with English (default) and Czech, namespace lazy loading.

**Code:**
- Install `react-i18next`, `i18next`, `i18next-browser-languagedetector`, `i18next-resources-to-backend` (instead of `i18next-http-backend` — `resources-to-backend` uses dynamic `import()` for Vite-native code splitting, keeping locale files in `src/` rather than `public/`)
- Create `src/shared/i18n/config.ts` — i18next init with `i18next-resources-to-backend` for lazy namespace loading via dynamic `import()`, language detector (localStorage + navigator), fallback to `en`
- Create `src/shared/i18n/locales/en/` and `src/shared/i18n/locales/cs/` directories
- Create namespace JSON files:
  - `common.json` — shared strings (buttons, labels, errors)
  - `auth.json` — login, register, recovery strings
  - `fields.json` — note, website, email field labels
  - `settings.json` — settings page strings
  - `crypto.json` — key management, security strings
- Wire i18n into app: import config in `src/main.tsx`, add `<Suspense>` boundary, update `src/App.tsx` to use `useTranslation()`
- Update `src/test/utils.tsx` — add `<Suspense>` to test wrapper
- Add language switcher component in `src/shared/ui/nav/LanguageSwitcher.tsx` (toggles between EN/CS, persists to localStorage via i18next-browser-languagedetector)
- No `useTranslation` wrapper hook — use `useTranslation` from `react-i18next` directly

**Tests:**
- Verify default language is `en`
- Verify switching to `cs` renders Czech strings
- Verify namespace lazy loading (separate chunks per namespace per language in build output)
- Verify fallback to `en` for missing `cs` keys
- App renders with i18n-translated strings and LanguageSwitcher

---

### Step 3 — Router + Route Structure + Suspense Boundaries ✅

**Goal:** TanStack Router configured with all app routes, layouts, and Suspense boundaries.

**Code:**
- Install `@tanstack/react-router`
- Create route tree:
  - `/` — redirect to `/dashboard` or `/login`
  - `/login` — public, auth page
  - `/register` — public, auth page
  - `/recover` — public, seed phrase recovery
  - `/dashboard` — protected, main app
  - `/settings` — protected, settings page
- Create `src/app/routes/` with route files
- Create `PublicLayout` component (centered card, no sidebar)
- Create `ProtectedLayout` component (sidebar + header + main content)
- Create `src/app/router.tsx` with route tree and type-safe routes
- Set up `RouterProvider` in `src/app/Providers.tsx`
- **Add Suspense boundaries at every route level** in the route tree. Each route wraps its component in `<Suspense fallback={<PageSkeleton />}>` so that:
  - Lazy-loaded route chunks show a skeleton while loading
  - Async data fetching (field decryption, key unwrapping) shows appropriate loading states
  - Crypto operations (Argon2id derivation) never leave the user staring at a blank screen
- Create `src/app/ErrorBoundary.tsx` — root error boundary that catches rendering errors and crypto-specific errors (decryption failure, corrupted data) with user-friendly messages
- **Lazy-load all route components** using TanStack Router's `lazyRouteComponent` or dynamic imports so the initial bundle only contains the root layout + auth redirect logic

**Tests:**
- Verify `/login` renders without auth
- Verify `/dashboard` redirects to `/login` when not authenticated
- Verify route type safety (TypeScript errors for invalid paths)
- Verify Suspense fallback renders while route chunk loads
- Verify error boundary catches and displays crypto errors

---

### Step 4 — State Management + Adapter Interfaces ✅

**Goal:** Zustand store, TanStack Query provider, and all adapter interfaces defined.

**Code:**
- Install `zustand`, `@tanstack/react-query`
- Create `src/app/Providers.tsx` — QueryClientProvider + i18n provider
- Create Zustand stores:
  - `src/features/auth/model/auth-store.ts` — session, user, isAuthenticated
  - `src/features/encryption/model/crypto-store.ts` — masterKey, KEK, fieldKeys, isVaultLocked (memory only, no persist). **Use plain `Record<string, string>` (hex-encoded) for fieldKeys instead of `Map<string, Uint8Array>`** — Zustand uses `Object.is` for shallow comparison, which fails on Map mutations and Uint8Array references. Hex strings are comparable by value and trigger correct re-renders.
  - `src/features/settings/model/ui-store.ts` — sidebarOpen, activeField. **Do NOT store `language` here** — `i18next` is the source of truth for language state. Only store UI state that i18next doesn't manage.
- Create adapter interfaces:
  - `src/shared/auth/auth.types.ts` — `IAuthAdapter` interface: `login(username, authHash)`, `logout()`, `getSession()`, `signup(username, authHash, keySalt)`, `recoverPassword()`
  - `src/shared/api/api.types.ts` — `IApiAdapter` interface: `getKeys(userId)`, `getFieldKeys(userId)`, `getField(userId, fieldName)`, `saveField(userId, fieldName, blob, iv)`, `saveWrappedKey(userId, data)`, `getRecovery(userId)`
  - `src/shared/realtime/realtime.types.ts` — `IRealtimeAdapter` interface: `subscribe(userId, callbacks)`, `unsubscribe()`
- Create `src/shared/types/crypto.types.ts` — TypeScript types for all crypto operations (WrappedKey, FieldKey, EncryptedField, KeyVersion, etc.)

**Tests:**
- Verify Zustand stores initialize correctly
- Verify adapter interfaces compile (no implementation yet)
- Verify crypto types are consistent (WrappedKey, FieldKey, etc.)
- Verify fieldKeys store uses plain Record (not Map) and hex strings (not Uint8Array)

---

### Step 5 — Supabase Local Setup + Database Schema ✅

**Goal:** Local Supabase running via Docker with all tables created and seeded.

**Code:**
- Install Supabase CLI: `pnpm add -D supabase`
- Run `supabase init` — creates `supabase/` directory
- Edit `supabase/config.toml` — configure local project settings
- Create migration files:
  - `supabase/migrations/00001_create_tables.sql`:
    - `users` table (minimal — Supabase Auth manages auth columns)
    - `keys` table (auth_salt, key_salt, wrapped_master_key, master_key_iv)
    - `field_keys` table (field_name, key_version, wrapped_key, key_iv)
    - `encrypted_fields` table (field_name, encrypted_blob, iv)
    - `recovery` table (recovery_salt, wrapped_master_key, recovery_iv)
  - `supabase/migrations/00002_rls_policies.sql`:
    - RLS policies: users can only CRUD their own data
    - Enable RLS on all tables
  - `supabase/migrations/00003_functions.sql`:
    - Helper function to get current user ID from auth context
- Create `supabase/seed.sql` — dev seed data (test user, test keys, test fields)
- Add `"dev": "supabase start && vite"` to `package.json`
- Add `"dev:reset": "supabase db reset && vite"` to `package.json`
- Document Supabase credentials in `.env.local.example`

**Tests:**
- Verify `supabase start` runs without errors
- Verify `supabase db reset` applies all migrations
- Verify RLS policies: user A cannot read user B's data
- Verify seed data is accessible

---

## Phase 2: Authentication

### Step 6 — Supabase Auth Adapter + Username Auth ✅

**Goal:** Working auth adapter that maps username → Supabase email.

**Code:**
- Install `@supabase/supabase-js`
- Create `src/shared/auth/supabase-adapter.ts` implementing `IAuthAdapter`:
  - `login(username, authHash)` → maps `username` to `{username}@ciphernote.internal`, calls `supabase.auth.signInWithPassword`
  - `signup(username, authHash, keySalt)` → maps email, calls `supabase.auth.signUp`, stores keySalt in user metadata
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

### Step 7 — Auth UI: Register + Login Pages ✅

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
- Error mapping module (in `features/auth/model/`) — map Supabase error messages to i18n keys (invalid credentials, username taken, network error)
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
- Unit tests: error mapping (Supabase errors → correct i18n keys)
- Unit tests: credential derivation placeholder

---

### Step 8 — Auth State + Protected Routes ✅

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

---

## Phase 3: Dashboard & Layout

### Step 9 — Dashboard Layout (Responsive) ✅

**Goal:** Responsive dashboard layout with sidebar, header, and main content area.

**Code:**
- `src/app/layouts/ProtectedLayout.tsx`:
  - Desktop: resizable sidebar (default 240px, range 150–1000px, persisted to localStorage) + header + scrollable main content
  - Mobile: bottom navigation bar, collapsible hamburger menu (fixed 240px Sheet, not resizable)
  - Sidebar: app logo, nav links (Dashboard, Settings), user info, lock vault button, language switcher
  - Header: page title, vault lock/unlock indicator
- `src/shared/ui/brand/AppLogo.tsx`
- `src/shared/ui/nav/Sidebar.tsx` — responsive sidebar component, shared between desktop aside and mobile Sheet overlay, with optional `onClose` prop for closing the Sheet on navigation
- `src/shared/ui/nav/MobileNav.tsx` — bottom navigation for mobile with vault toggle center button
- `src/shared/ui/nav/ResizeHandle.tsx` — thin drag handle between sidebar and main content on desktop, 2×3 dot matrix grip indicator with hover/drag accent colors, hidden on mobile
- `src/shared/lib/use-resizable.ts` — custom hook managing drag resize logic: local state for smooth 60fps dragging, commits final width to Zustand store on release, pointer events for unified mouse+touch support
- `src/features/settings/model/ui-store.ts` — added `sidebarWidth: number` (default 240) and `setSidebarWidth` action, persisted to localStorage via `partialize`
- `src/features/encryption/ui/VaultIndicator.tsx` — shows locked/unlocked state in header
- Use shadcn `Sheet` for mobile sidebar overlay and `Separator` for sidebar section dividers
- Use existing `NavLink` component with lucide icons for nav items (not `NavigationMenu` — only 2 nav items, simpler approach)
- Add i18n strings to `common.json`

**Tests:**
- Component test: sidebar renders with all nav items, user info, lock button, language switcher
- Component test: mobile nav renders dashboard/settings items and vault toggle
- Component test: vault indicator shows "locked" state by default and "unlocked" when store changes
- Component test: layout renders vault indicator and hamburger menu button
- Component test: desktop sidebar uses dynamic width from store
- Component test: resize handle renders with role="separator"
- Unit test: useResizable hook — initial width, clamping, drag state, commit on release, cleanup
- Unit test: UI store — sidebarWidth state and setSidebarWidth action

---

### Step 10 — Dashboard Page Shell + Field Components ✅

**Goal:** Dashboard page with three encrypted field sections (UI only, no crypto yet).

**Code:**
- Dashboard page component (in `features/fields/ui/`):
  - Three card sections: Note, Website, Email
  - Each card shows field name and encrypted/decrypted indicator
  - "Locked" state: shows lock icon + placeholder text (from i18n) + unlock button
  - "Unlocked" state: renders the appropriate field editor via children pattern
- `src/features/fields/ui/FieldCard.tsx`:
  - Props: `fieldName`, `isLocked`, `onUnlock`, `children`
  - Locked: shows lock icon + i18n locked message + unlock button
  - Unlocked: renders `children` (composition pattern — parent decides which editor to show)
- `src/features/fields/ui/NoteField.tsx` — textarea for note content with auto-resize rows
- `src/features/fields/ui/WebsiteField.tsx` — input with type="url" and autocomplete="url"
- `src/features/fields/ui/EmailField.tsx` — input with type="email" and autocomplete="email"
- Route file (`src/app/routes/_authenticated.dashboard.tsx`) — thin wrapper importing DashboardPage from features
- Add i18n strings to `fields.json` (including `unlock` key per field and `lastUpdated` with interpolation)
- `lastUpdated` timestamp display deferred to when the data layer is wired (no data yet)

**Tests:**
- Component tests: FieldCard renders locked state with lock icon, locked message, and unlock button
- Component tests: FieldCard renders unlocked state with children content
- Component tests: FieldCard uses correct i18n labels for each field name
- Component tests: each field type renders correctly (textarea for note, url input, email input)
- Component test: DashboardPage renders all three field cards
- Component test: DashboardPage shows locked state when vault is locked, unlocked state with editors when vault is unlocked

---

### Step 11 — Settings Page Shell ✅

**Goal:** Settings page with sections for security, preferences, and account.

**Code:**
- `src/features/settings/ui/SettingsPage.tsx`:
  - Sections: Security, Preferences, Account
  - Security section: Change Password, View Seed Phrase, Key Versions
  - Preferences: Language selector with full variant showing language names (en/cs)
  - Account: Username display (via shared auth hook), Delete Account button
- `src/features/settings/ui/SecuritySection.tsx` — change password + seed phrase links
- `src/features/settings/ui/PreferencesSection.tsx` — language switcher (full variant)
- `src/features/settings/ui/AccountSection.tsx` — account info + delete
- Enhance `LanguageSwitcher` with `variant` prop: `compact` (toggle button in sidebar/mobile) and `full` (button group showing language names, used in Preferences)
- Shared `useCurrentUser` hook in `src/shared/auth/` to access current user data without cross-feature imports from auth store
- Add i18n strings to `settings.json` (including `languageName.en/cs` for full variant labels)

**Tests:**
- Component tests: SettingsPage renders all sections
- Component tests: language switcher changes app language (both variants)
- Component test: security section links are present

---

## Phase 4: Crypto Foundation

### Step 12 — AES-256-GCM Encrypt/Decrypt ✅

**Goal:** Web Crypto API wrapper for AES-256-GCM encryption and decryption of field content.

**Code:**
- `src/shared/crypto/aes-gcm.ts`:
  - `generateIV(): Uint8Array<ArrayBuffer>` — generate 12-byte random IV using `crypto.getRandomValues`
  - `encrypt(plaintext: Uint8Array<ArrayBuffer>, key: CryptoKey, iv?: Uint8Array<ArrayBuffer>): Promise<{ciphertext: Uint8Array<ArrayBuffer>, iv: Uint8Array<ArrayBuffer>}>`
  - `decrypt(ciphertext: Uint8Array<ArrayBuffer>, key: CryptoKey, iv: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>>` — wraps all `crypto.subtle.decrypt` failures in `DecryptionError` (from `shared/crypto/errors`), preserving original error as `cause`
  - `importKey(rawKey: Uint8Array<ArrayBuffer>): Promise<CryptoKey>` — validates 32-byte key length, then import as AES-GCM CryptoKey with `extractable: true`
  - `exportKey(key: CryptoKey): Promise<Uint8Array<ArrayBuffer>>` — export CryptoKey to raw bytes
  - `generateKey(): Promise<CryptoKey>` — generate random 256-bit AES-GCM key with `extractable: true`
- All operations use Web Crypto API (`crypto.subtle`)
- IV is always 12 bytes (96 bits)
- Use `crypto.subtle.encrypt` with `{ name: 'AES-GCM', iv }` and `crypto.subtle.decrypt` similarly
- **TypeScript 6.0 note:** All `Uint8Array` type annotations in Web Crypto function signatures must use `Uint8Array<ArrayBuffer>` (not bare `Uint8Array` which expands to `Uint8Array<ArrayBufferLike>`). The Web Crypto API expects `BufferSource` which requires `ArrayBufferView<ArrayBuffer>`, excluding `SharedArrayBuffer`. This applies to all future crypto modules that pass `Uint8Array` to `crypto.subtle` methods.
- **Error handling:** `decrypt` wraps all failures (wrong key, wrong IV, tampered data) in `DecryptionError` from `shared/crypto/errors.ts`, passing `undefined` for the message (uses default `'crypto:errors.decryptFailed'`) and preserving the original `OperationError` as `cause`. The `DecryptionError` constructor accepts `ErrorOptions` as a second parameter to support this.
- **`importKey` validation:** Explicitly checks `rawKey.length !== 32` and throws a descriptive error, because the Web Crypto API accepts 128-bit keys for AES-GCM (which is valid AES but wrong for our AES-256 use case).

**Tests:**
- Encrypt then decrypt returns original plaintext
- Different IVs produce different ciphertexts for same plaintext
- Decrypt with wrong key throws `DecryptionError`
- Decrypt with wrong IV throws `DecryptionError`
- Tampered ciphertext (modified byte) causes decrypt to throw `DecryptionError`
- `DecryptionError` preserves original error as `cause`
- Round-trip with Uint8Array of various sizes (0 bytes, 1 byte, 100 bytes, 10000 bytes)
- `generateKey()` produces 256-bit (32-byte) key
- `importKey` / `exportKey` round-trip preserves key bytes
- `importKey` with non-32-byte key throws error

---

### Step 13 — Key Wrapping/Unwrapping ✅

**Goal:** AES-256-GCM key wrapping with AAD for version protection and rollback detection.

**Code:**
- Extend `encrypt` and `decrypt` in the AES-GCM module with optional `aad?: Uint8Array<ArrayBuffer>` parameter (backward-compatible: callers without AAD work identically). Use `AesGcmParams` type for the algorithm object so `additionalData` is allowed. When AAD is provided, set `algorithm.additionalData = aad`
- `src/shared/crypto/key-wrap.ts`:
  - `wrapKey(plaintextKey: Uint8Array<ArrayBuffer>, wrappingKey: CryptoKey, aad: Uint8Array<ArrayBuffer>): Promise<WrappedKey>`
    - Generate random 12-byte IV
    - Encrypt `plaintextKey` with `wrappingKey` using AES-256-GCM with AAD
    - Return `{ wrappedKey, iv }`
  - `unwrapKey(wrappedKey: Uint8Array<ArrayBuffer>, wrappingKey: CryptoKey, iv: Uint8Array<ArrayBuffer>, aad: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>>`
    - Decrypt `wrappedKey` with `wrappingKey` using AES-256-GCM with AAD — throws `DecryptionError` on wrong key, wrong IV, wrong AAD, or tampered data
    - Return raw key bytes
  - `encodeAAD(fieldName: string, version: number): Uint8Array<ArrayBuffer>` — length-prefixed binary encoding: `[2-byte name length BE][name UTF-8 bytes][4-byte version BE]`. Collision-free regardless of field name characters
- `WrappedKey` type in `crypto.types.ts` uses `Uint8Array<ArrayBuffer>` (not bare `Uint8Array`) for Web Crypto compatibility

**Tests:**
- Wrap then unwrap returns original key
- Unwrap with wrong wrapping key throws
- Unwrap with wrong AAD (different version) throws — verifies rollback protection
- Unwrap with tampered wrapped key throws
- Unwrap with wrong IV throws
- Different AAD values produce different wrapped keys
- AAD encoding: `encodeAAD("note", 1)` ≠ `encodeAAD("note", 2)` ≠ `encodeAAD("website", 1)`

---

### Step 14 — Argon2id Key Derivation ✅

**Goal:** Argon2id derivation with two salts (auth + key), producing auth_hash and password_key.

**Code:**
- `src/shared/crypto/argon2id.ts`:
  - `deriveKey(password: string, salt: Uint8Array, params?: Argon2Params): Promise<Uint8Array<ArrayBuffer>>`
    - Default params: `m=47104, t=3, p=1, outputLen=32`
    - **Delegates all derivation to a Web Worker** via `postMessage` — the main module never loads argon2-browser. Sends a `DeriveRequest` message and receives a `Result` or `Error` response back.
  - `deriveAuthHash(password: string, authSalt: Uint8Array<ArrayBuffer>): Promise<string>`
    - Derive auth hash for Supabase Auth verification
    - Returns 64-character hex string (32 bytes encoded as hex) for Supabase Auth "password"
  - `derivePasswordKey(password: string, keySalt: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>>`
    - Derive password key for wrapping the master key
    - Returns 32-byte key
  - `generateSalt(): Uint8Array<ArrayBuffer>` — generate 16-byte random salt
- `Argon2Params` type in `src/shared/types/crypto.types.ts`
- Worker message types (`Argon2DeriveRequest`, `Argon2DeriveResult`, `Argon2DeriveError`, `Argon2WorkerResponse`) in shared types — used by both the main module and the worker
- **Web Worker** (`argon2id.worker.ts`) — handles `argon2-browser` lazy-loading and Argon2id computation. The main thread sends `{password, salt, params}` to the worker and receives the derived key back. The Web Worker lazy-loads `argon2-browser` via dynamic `import()` and caches the module reference for subsequent calls.
- `Argon2Error` class extending `CryptoError` — wraps all Argon2id derivation and Worker errors with i18n key `crypto:errors.argon2Failed`
- **Code splitting:** Ensure `argon2-browser` is in its own Vite chunk by using dynamic `import('argon2-browser')` inside the Web Worker. This keeps the WASM binary out of the initial bundle.

**Tests:**
- Same password + same salt → same output (deterministic)
- Different password + same salt → different output
- Same password + different salt → different output
- Output is always 32 bytes
- `deriveAuthHash` and `derivePasswordKey` with same password but different salts produce different results
- `generateSalt()` produces 16-byte unique salts
- Performance: derivation completes within 5 seconds on modern hardware

---

### Step 15 — HKDF Key Derivation + Key Hierarchy ✅

**Goal:** HKDF-SHA-256 for deriving KEK and signing key seed from master key. Full key hierarchy module.

**Code:**
- `src/shared/crypto/hkdf.ts`:
  - `deriveSubKey(masterKey: Uint8Array<ArrayBuffer>, info: string, length?: number): Promise<Uint8Array<ArrayBuffer>>`
    - Validates masterKey is exactly 32 bytes (throws descriptive error if not)
    - Uses Web Crypto API `crypto.subtle.deriveBits` with HKDF (not `deriveKey` — we need raw bytes because KEK bytes are later imported as an AES-GCM CryptoKey separately)
    - Empty salt (master key is already a cryptographically random 256-bit value; HKDF uses zero-filled salt internally)
    - `info` parameter: `"wrap"` → KEK, `"sign"` → Signing Key Seed
    - Default `length=32` (256 bits), converted to bits for `deriveBits`
  - `deriveKEK(masterKey: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>>` — `deriveSubKey(masterKey, "wrap")`
  - `deriveSigningKeySeed(masterKey: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>>` — `deriveSubKey(masterKey, "sign")`
- `src/shared/crypto/key-hierarchy.ts`:
  - `generateMasterKey(): Uint8Array<ArrayBuffer>` — generate random 256-bit master key
  - `generateFieldKeys(): Map<string, Uint8Array<ArrayBuffer>>` — generate all three field keys (note, website, email) at once, each 256-bit random
  - `deriveFullKeyHierarchy(masterKey: Uint8Array<ArrayBuffer>): Promise<KeyHierarchy>`
    - Derives KEK and signing key seed in parallel via `Promise.all`
    - Imports raw KEK bytes as AES-GCM CryptoKey via `importKey`
    - Returns `{ masterKey, kek: CryptoKey, signingKeySeed }`
  - `wrapFieldKeys(fieldKeys: Map<string, Uint8Array<ArrayBuffer>>, kek: CryptoKey, versions: Map<string, number>): Promise<WrappedFieldKey[]>`
    - Validates version presence for each field (throws if missing)
    - Wrap all field keys with KEK using AAD (field_name + version) in parallel via `Promise.all`
  - `unwrapFieldKeys(wrappedKeys: WrappedFieldKey[], kek: CryptoKey): Promise<Map<string, Uint8Array<ArrayBuffer>>>`
    - Unwrap all field keys in parallel via `Promise.all`, verify AAD for each (throws DecryptionError on wrong version/key)
  - `KeyHierarchy` type in `src/shared/types/crypto.types.ts`
- `WrappedFieldKey` type: `{ fieldName: string, version: number, wrappedKey: Uint8Array<ArrayBuffer>, iv: Uint8Array<ArrayBuffer> }`

**Tests:**
- HKDF: same master key + same info → same sub-key (deterministic)
- HKDF: same master key + different info → different sub-keys
- HKDF: different master key + same info → different sub-keys
- HKDF: `deriveSubKey` with empty info string produces deterministic output
- HKDF: `deriveSubKey` throws for non-32-byte master key
- `deriveKEK` ≠ `deriveSigningKeySeed` for same master key
- `generateFieldKeys` returns Map with note, website, and email keys
- Key hierarchy: generate → wrap → unwrap → verify all keys match
- Field key wrapping: version in AAD prevents rollback (unwrap with wrong version throws)
- `wrapFieldKeys` with empty map returns empty array
- `unwrapFieldKeys` with empty array returns empty map
- Full round-trip: generate master key → derive KEK → generate field keys → wrap with KEK → unwrap with KEK → decrypt field content

---

### Step 16 — Split KDF Module ✅

**Goal:** Complete Split KDF implementation for authentication and key derivation.

**Code:**
- Split KDF module:
  - `deriveAuthCredentials(password: string): Promise<AuthCredentials>`
    - Generate `auth_salt` (16 bytes) and `key_salt` (16 bytes) via `generateSalt()`
    - Derive `auth_hash` and `password_key` in parallel via `Promise.all`
    - Return `{ authHash, passwordKey, authSalt, keySalt }`
  - `deriveLoginCredentials(password: string, authSalt: Uint8Array<ArrayBuffer>, keySalt: Uint8Array<ArrayBuffer>): Promise<LoginCredentials>`
    - Given existing salts (from server), derive both keys in parallel
    - Return `{ authHash, passwordKey }`
  - `changePassword(oldPassword: string, newPassword: string, keySalt: Uint8Array<ArrayBuffer>, wrappedMasterKey: Uint8Array<ArrayBuffer>, masterKeyIV: Uint8Array<ArrayBuffer>): Promise<PasswordChangeResult>`
    - Derive old password key → import as CryptoKey → decrypt master key (no AAD)
    - Generate new auth_salt and key_salt
    - Derive new auth_hash and password_key in parallel
    - Re-wrap master key with new password key using AES-256-GCM (no AAD)
    - Master key wrapping uses no AAD because the master key has no field name or version concept, unlike field key wrapping which uses AAD(fieldName, version)
    - Return `{ newAuthHash, newAuthSalt, newKeySalt, newWrappedMasterKey, newMasterKeyIV }`
- `AuthCredentials`, `LoginCredentials`, `PasswordChangeResult` types already exist in crypto.types.ts — no changes needed
- `derive-placeholder.ts` remains in place until Steps 19/21 replace its consumer in auth-credentials.ts

**Tests:**
- `deriveAuthCredentials`: generates two salts, calls Argon2id with correct args, returns correct types
- `deriveLoginCredentials`: derives from existing salts without generating new ones, matches `deriveAuthCredentials` output for same password and salts
- `changePassword`: round-trip — unwrap with old key, re-wrap with new key, verify master key unchanged
- `changePassword`: new salts differ from old salts
- `changePassword`: throws `DecryptionError` if wrong old password (cannot unwrap master key)
- `changePassword`: calls `generateSalt` exactly twice for new salts

---

### Step 17 — BIP-39 Mnemonic Module

**Goal:** Generate, validate, and use BIP-39 mnemonic for seed phrase recovery.

**Code:**
- `src/shared/crypto/mnemonic.ts`:
  - `generateMnemonic(): string` — generate 12-word BIP-39 mnemonic from 128-bit entropy
  - `validateMnemonic(mnemonic: string): boolean` — validate checksum and word list
  - `mnemonicToSeed(mnemonic: string): Uint8Array` — convert mnemonic to 256-bit seed (for recovery_KEK derivation)
  - `deriveRecoveryKEK(mnemonic: string, recoverySalt: Uint8Array): Promise<Uint8Array>` — Argon2id(mnemonic_phrase, recovery_salt) → recovery KEK
  - `wrapMasterKeyWithRecovery(masterKey: Uint8Array, mnemonic: string, recoverySalt?: Uint8Array): Promise<RecoveryData>`
    - Generate recovery_salt if not provided
    - Derive recovery_KEK from mnemonic + salt
    - Wrap master key with recovery_KEK using AES-256-GCM
    - Return `{ wrappedMasterKey, recoveryIV, recoverySalt }`
  - `unwrapMasterKeyWithRecovery(wrappedMasterKey: Uint8Array, mnemonic: string, recoverySalt: Uint8Array, recoveryIV: Uint8Array): Promise<Uint8Array>`
    - Derive recovery_KEK from mnemonic + salt
    - Unwrap master key
    - Return master key bytes
- `RecoveryData` type in crypto.types.ts
- **Code splitting:** `@scure/bip39` contains a 2048-word dictionary and must be lazy-loaded via dynamic `import()`. The `generateMnemonic`, `validateMnemonic`, and `mnemonicToSeed` functions should dynamically import `@scure/bip39` internally rather than importing it at module level. This ensures the word list is only loaded when the user is registering or recovering their account.

**Tests:**
- Generate mnemonic produces 12-word string
- Validate mnemonic accepts valid mnemonics
- Validate mnemonic rejects invalid mnemonics (wrong words, wrong checksum)
- `wrapMasterKeyWithRecovery` → `unwrapMasterKeyWithRecovery` returns original master key
- Different mnemonics cannot unwrap (wrong mnemonic throws)
- Tampered wrapped key cannot be unwrapped (integrity check)
- Recovery salt is 16 bytes and unique per generation

---

### Step 18 — Crypto Integration Tests

**Goal:** Full end-to-end crypto flow tests proving the entire key hierarchy works together.

**Code:**
- `src/shared/crypto/__tests__/integration.test.ts`:
  - **Registration flow test:**
    1. Generate master key
    2. Derive auth credentials from password
    3. Derive full key hierarchy (KEK, signing key)
    4. Generate three field keys (note, website, email)
    5. Wrap field keys with KEK (version 1)
    6. Wrap master key with password key
    7. Generate mnemonic and wrap master key with recovery KEK
    8. Verify all wrapped keys can be unwrapped
  - **Login flow test:**
    1. Given stored salts, derive login credentials from password
    2. Unwrap master key with password key
    3. Derive KEK from master key
    4. Unwrap all field keys with KEK
    5. Verify field keys match originals
  - **Decrypt field content test:**
    1. Encrypt plaintext with field key
    2. Decrypt with field key
    3. Verify round-trip
  - **Password change test:**
    1. Unwrap master key with old password key
    2. Derive new credentials with new password
    3. Re-wrap master key
    4. Unwrap with new password key → verify master key unchanged
    5. Field keys unaffected (don't need re-wrap)
  - **Seed phrase recovery test:**
    1. Wrap master key with recovery KEK
    2. Unwrap master key with mnemonic
    3. Derive full key hierarchy
    4. Decrypt all fields
  - **Key rotation test:**
    1. Rotate one field key (e.g., note v1 → v2)
    2. Re-encrypt field content with new key
    3. Verify old key can no longer decrypt
    4. Verify other field keys (website, email) are unaffected

**Tests:**
- All integration tests pass
- Performance: full registration flow completes within 5 seconds
- Performance: full login flow (including Argon2id) completes within 5 seconds

---

## Phase 5: Registration & Login Flows

### Step 19 — Registration Crypto Flow

**Goal:** Wire up the full registration flow: derive keys, wrap, store on server.

**Code:**
- `src/features/encryption/model/registration.ts`:
  - `registerUser(username: string, password: string): Promise<RegistrationResult>`
    1. Generate salts: auth_salt, key_salt
    2. Derive auth credentials: auth_hash + password_key
    3. Generate master key (256-bit random)
    4. Derive key hierarchy: KEK, signing key seed
    5. Generate field keys: note, website, email (256-bit random each, version 1)
    6. Wrap field keys with KEK (AAD = field_name + version)
    7. Wrap master key with password key
    8. Generate recovery mnemonic
    9. Wrap master key with recovery KEK
    10. Return all data needed to upload to server
- `RegistrationResult` type: all wrapped keys, salts, IVs, recovery data, mnemonic
- `src/features/encryption/model/upload-keys.ts`:
  - `uploadRegistrationData(data: RegistrationResult, userId: string): Promise<void>`
    - Call Supabase API adapter to store: keys, field_keys, encrypted_fields, recovery
- Handle error cases: username taken, network error, Argon2id timeout

**Tests:**
- Unit: `registerUser` returns all required fields (wrapped keys, salts, IVs, mnemonic)
- Unit: returned wrapped master key can be unwrapped with password_key
- Unit: returned wrapped field keys can be unwrapped with derived KEK
- Unit: mnemonic can unwrap master key via recovery KEK
- Integration: full registration → upload to local Supabase → verify data in DB

---

### Step 20 — Registration UI

**Goal:** Registration page with password strength indicator and mnemonic display.

**Code:**
- Update `src/pages/register/RegisterPage.tsx`:
  - Call `registerUser()` on form submit
  - Show Argon2id derivation progress (spinner or progress indicator)
  - On success: show mnemonic in a `<Dialog>` with:
    - 12-word mnemonic displayed in groups of 3
    - "Copy to clipboard" button
    - "Download as text file" button
    - Warning text: "Store this seed phrase securely. It cannot be recovered if lost."
    - Checkbox: "I have stored my seed phrase" (required before continuing)
  - On "Continue" after mnemonic confirmation: redirect to `/dashboard`
  - Error states: username taken, network error
- Create `src/features/auth/ui/MnemonicDialog.tsx` — reusable mnemonic display component
- Create `src/features/auth/ui/PasswordStrength.tsx` — password strength indicator
- Add i18n strings to `auth.json` for registration flow

**Tests:**
- Component test: registration form validates inputs
- Component test: mnemonic dialog shows 12 words
- Component test: "Copy" button copies mnemonic to clipboard
- Component test: "I have stored my seed phrase" checkbox is required
- Component test: password strength indicator updates on input
- E2E: register → see mnemonic → acknowledge → redirect to dashboard

---

### Step 21 — Login Crypto Flow

**Goal:** Wire up the full login flow: derive keys, unwrap, verify.

**Code:**
- `src/features/encryption/model/login.ts`:
  - `loginUser(username: string, password: string): Promise<LoginResult>`
    1. Fetch auth_salt, key_salt from server (via API adapter)
    2. Derive login credentials: auth_hash + password_key
    3. Authenticate with Supabase Auth (auth_hash as "password")
    4. Fetch wrapped master key from server
    5. Unwrap master key with password_key
    6. Derive KEK from master key
    7. Fetch wrapped field keys from server
    8. Unwrap field keys with KEK
    9. Store master key, KEK, field keys in crypto store (Zustand, memory only)
    10. Return success with user info
- `LoginResult` type: user info, unlocked vault state
- Handle error cases: wrong password (unwrap fails), network error, corrupted data
- `src/features/encryption/model/vault-lock.ts`:
  - `lockVault(): void` — zero all keys in crypto store, set isVaultLocked = true, **purge TanStack Query cache for all field data** (call `queryClient.removeQueries({ queryKey: ['field'] })`)
  - `unlockVault(password: string): Promise<void>` — re-run login flow, set isVaultLocked = false

**Tests:**
- Unit: `loginUser` with correct password unwraps all keys correctly
- Unit: `loginUser` with wrong password fails at auth step
- Unit: `lockVault` zeros all keys in store
- Unit: `unlockVault` restores keys to store
- Integration: register user → login → verify keys match
- Integration: wrong password → auth fails → vault stays locked

---

### Step 22 — Login UI + Vault Unlock

**Goal:** Login page with vault unlock flow.

**Code:**
- Update `src/pages/login/LoginPage.tsx`:
  - On submit: call `loginUser(username, password)`
  - Show loading state during Argon2id derivation
  - On success: redirect to `/dashboard`
  - On error: show error message (wrong password, network error)
- `src/features/encryption/ui/VaultUnlockDialog.tsx`:
  - Modal dialog shown when vault is locked (user is authenticated but vault is locked)
  - Password input to unlock vault
  - "Unlock" button
  - "Lock vault" button in sidebar/header to lock vault manually
  - Auto-lock after inactivity timeout (configurable, default 15 minutes)
- `src/features/encryption/model/vault-timeout.ts`:
  - Reset timer on user activity (mouse move, keypress)
  - Lock vault when timer expires
- Wire vault state into dashboard layout (VaultIndicator component)

**Tests:**
- Component test: login form shows loading during Argon2id
- Component test: wrong password shows error message
- Component test: vault unlock dialog appears when vault is locked
- Component test: successful unlock closes dialog and shows decrypted fields
- Component test: auto-lock triggers after inactivity timeout
- E2E: login → see locked vault → enter password → see decrypted fields

---

### Step 23 — Crypto Session Store (Zustand) + Query Cache Purge

**Goal:** Zustand store for in-memory cryptographic keys. Never persisted. TanStack Query cache purged on vault lock.

**Code:**
- `src/features/encryption/model/crypto-store.ts` (enhance existing store):
  - State: `masterKey`, `kek`, `fieldKeys: Record<string, string>` (hex-encoded strings, NOT Uint8Array or Map), `isVaultLocked`, `lastActivity`
  - Actions: `setKeys(masterKey, kek, fieldKeys)`, `lockVault()`, `updateActivity()`, `getFieldKey(fieldName)`
  - `lockVault()` zeros all key material using `cryptoZeroFill(key)` — overwrites Uint8Array with zeros, then clears all state fields and sets `isVaultLocked = true`
  - **Critical:** `lockVault()` must also call `queryClient.removeQueries({ queryKey: ['field'] })` to purge all decrypted field content from TanStack Query's cache. Without this, decrypted plaintext remains in memory after vault lock. The `queryClient` reference is obtained from the React component tree or passed in during store initialization.
- `src/shared/crypto/memory.ts`:
  - `zeroFill(buffer: Uint8Array): void` — securely overwrite array with zeros
  - `copyToUint8Array(data: ArrayBuffer | Uint8Array): Uint8Array` — safe copy for storing in Zustand
  - `hexEncode(data: Uint8Array): string` — encode Uint8Array as hex string for Zustand storage
  - `hexDecode(hex: string): Uint8Array` — decode hex string back to Uint8Array for crypto operations
- Verify that no crypto keys appear in localStorage, sessionStorage, or IndexedDB

**Tests:**
- Unit: `setKeys` stores all keys correctly (hex-encoded)
- Unit: `getFieldKey('note')` returns correct hex-encoded key
- Unit: `lockVault` zeros all keys and sets isVaultLocked = true
- Unit: after `lockVault`, `getFieldKey` returns null/undefined
- Unit: `lockVault` removes all TanStack Query cache entries for field data
- Integration: login → setKeys → verify keys in store → lockVault → verify keys zeroed AND query cache empty
- Security: verify no keys in localStorage/sessionStorage after login
- Security: verify decrypted field content is not in TanStack Query cache after vault lock

---

## Phase 6: Encrypted Data Layer

### Step 24 — Supabase API Adapter

**Goal:** Full CRUD implementation for all database operations, split into focused modules.

**Code:**
- `src/shared/api/supabase-client.ts` — Supabase client initialization and export only (no business logic)
- `src/shared/api/supabase-keys.ts` — Keys CRUD:
  - `getKeys(userId: string): Promise<ServerKeys>` — fetch auth_salt, key_salt, wrapped_master_key, master_key_iv
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

### Step 25 — Encrypted Field CRUD

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

### Step 26 — Auto-Save + Sync Flow

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

---

## Phase 7: Realtime & Multi-Device

### Step 27 — Supabase Realtime Adapter

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
  - When key rotation event comes: invalidate field key cache → re-fetch wrapped key → re-unwrap with KEK
- Handle conflict: if local and remote both changed same field, show notification "Field updated remotely. Reload?"

**Tests:**
- Integration: update field on "device A" → "device B" receives realtime event → field updates
- Integration: key rotation on device A → device B receives event → field key updates
- Unit: `subscribe` sets up Supabase Realtime channel
- Unit: `unsubscribe` cleans up channel

---

### Step 28 — Multi-Device Session Handling

**Goal:** Handle multiple active sessions and key rotation across devices.

**Code:**
- `src/features/encryption/model/multi-device.ts`:
  - When a field key version changes (detected via realtime): re-fetch and re-unwrap field key
  - When master key is rotated (password change on another device): force re-login
  - Session invalidation: if auth session expires, lock vault and redirect to login
- `src/features/fields/ui/ConflictNotification.tsx`:
  - Show toast notification when remote change conflicts with local edit
  - Options: "Keep mine" or "Use remote version"
- Handle Supabase Auth token refresh: auto-refresh JWT before expiry

**Tests:**
- Integration: password change on device A → device B detects session change → prompts re-login
- Unit: key rotation event → re-fetch field key → re-unwrap → success
- Unit: session expiry → vault locks → redirect to login

---

## Phase 8: Password & Recovery

### Step 29 — Change Password Flow + UI

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

### Step 30 — Seed Phrase Backup View

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

### Step 31 — Seed Phrase Recovery Flow + UI

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

### Step 32 — Key Rotation + UI

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

---

## Phase 9: Polish

### Step 33 — Mobile Responsive Refinements

**Goal:** Ensure all pages work well on mobile viewports.

**Code:**
- Audit all pages on 375px (iPhone SE), 390px (iPhone 14), 768px (iPad):
  - Login/Register: stacked form, full-width inputs
  - Dashboard: stacked field cards (no sidebar), bottom navigation
  - Settings: stacked sections, full-width inputs
  - Mnemonic dialog: scrollable word list, larger tap targets
  - Vault unlock dialog: full-screen on mobile
- Touch targets: minimum 44px tap area for all interactive elements
- Keyboard handling: scroll to focused input on mobile
- Safe area insets: respect `env(safe-area-inset-*)` for notched devices
- Swipe gestures: consider swipe to lock vault on mobile

**Tests:**
- Visual/interaction test on each viewport size
- Verify no horizontal scroll on mobile
- Verify all touch targets meet minimum size
- Verify keyboard doesn't obscure active input

---

### Step 34 — Loading States, Error Boundaries, Toast Notifications

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

### Step 35 — Security Hardening

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

### Step 36 — E2E Tests (Playwright)

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

---

## Summary

| Phase | Steps | Focus |
|-------|-------|-------|
| 1. Project Foundation | 1–5 | Scaffolding, UI framework, i18n, router, state, Supabase |
| 2. Authentication | 6–8 | Supabase Auth, register/login UI, auth state |
| 3. Dashboard & Layout | 9–11 | Responsive layout, field cards, settings shell |
| 4. Crypto Foundation | 12–18 | AES-GCM, key wrapping, Argon2id, HKDF, key hierarchy, Split KDF, BIP-39 |
| 5. Registration & Login | 19–23 | Full registration flow, login flow, vault unlock, crypto store |
| 6. Encrypted Data | 24–26 | API adapter, field encrypt/decrypt, auto-save |
| 7. Realtime & Multi-Device | 27–28 | Supabase Realtime, conflict resolution |
| 8. Password & Recovery | 29–32 | Change password, seed phrase view/recovery, key rotation |
| 9. Polish | 33–36 | Mobile, UX polish, security hardening, E2E tests |

**Total: 36 steps.**

Each step is designed to be implementable in under a day. Crypto steps (12–18) may run closer to a full day due to the precision required. UI steps (9–11, 20, 22) should be faster. The plan is ordered UI-first so you see visual progress early, with crypto foundation coming before the data layer that depends on it.