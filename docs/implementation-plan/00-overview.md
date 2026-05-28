# Implementation Plan — Overview

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
| Code splitting | argon2-browser (bundled build) + @scure/bip39 lazy-loaded via dynamic import + Web Worker |
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
username → {username}@ciphernote.internal
```

The user never sees this email. The app stores the real username in `auth.users.raw_user_meta_data` and displays it in the UI. The `auth_hash` (derived from the password via Argon2id) is sent as the Supabase Auth "password" — Supabase never sees the real password.

### Crypto Session (Vault)

When the user logs in and unlocks their vault, the Master Key, KEK, and field keys live in a Zustand store (memory only — never persisted). When the vault is locked, all keys are zeroed from memory. This Zustand store has no `persist` middleware — keys exist only while the session is active.

### Adapter Pattern

All backend-specific code lives behind interfaces in `shared/`. Features import interface types, never implementations directly. Swapping backends means writing new adapters, not rewriting features.

- `shared/auth/` — Auth interface (`login`, `logout`, `getSession`, `signup`, `recoverPassword`). Supabase Auth adapter today; custom JWT or OPAQUE adapter later.
- `shared/api/` — Data access interface (`getMasterKeyEnvelope`, `saveField`, `getField`, etc.). Supabase client queries today; REST calls to Hono API later.
- `shared/realtime/` — Realtime interface (`subscribe`, `unsubscribe`, `onFieldChange`). Supabase Realtime today; raw WebSocket to Hono server later.

---

## Project Structure

```
cipher-note-react/
  src/
    app/
      Providers.tsx            # QueryClientProvider, i18n, AuthProvider
      flows/
        auth-flow.ts            # Orchestrate: signup, login, logout, session restore, unlock vault
      router.tsx               # TanStack Router route tree
      ErrorBoundary.tsx       # Root error boundary with crypto error handling
      styles/
        globals.css            # Tailwind directives + shadcn CSS variables
      layouts/
        PublicLayout.tsx        # Centered card layout for auth pages
        ProtectedLayout.tsx     # Sidebar + header + main content
      routes/
        __root.tsx              # Root route with providers + Suspense boundary
        _public.tsx              # Public layout route (GuestOnly)
        _public.login.tsx       # /login route (lazy-loaded)
        _public.register.tsx    # /register route (lazy-loaded)
        _public.recover.tsx     # /recover route (lazy-loaded)
        _authenticated.tsx      # Authenticated layout route (RequireAuth)
        _authenticated.dashboard.tsx # /dashboard route (lazy-loaded, protected)
        _authenticated.settings.tsx  # /settings route (lazy-loaded, protected)
    features/
      auth/
        model/
          auth-store.ts        # Zustand: session, user, isAuthenticated
          auth-error-messages.ts # getAuthErrorMessage: AuthErrorCode → i18n key
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
          vault-timeout.ts     # Auto-lock after inactivity
          key-rotation.ts      # Rotate individual field keys
          multi-device.ts      # Handle key changes from other sessions
          registration.ts      # Pure crypto: deriveRegistrationKeys
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
        sonner.tsx
        # etc. — each shadcn component in its own file, imported directly
      crypto/
        aes-gcm.ts            # AES-256-GCM encrypt/decrypt/importKey/exportKey
        argon2id.ts           # Argon2id derivation via argon2-browser bundled build (lazy-loaded)
        hkdf.ts               # HKDF-SHA-256 sub-key derivation
        key-hierarchy.ts     # Master key → KEK → field keys orchestration
        split-kdf.ts          # Split KDF (auth + key derivation from password)
        mnemonic.ts           # BIP-39 generate/validate/wrap/unwrap (lazy-loaded)
        crypto-utils.ts       # hexEncode, hexDecode, generateIV, generateSalt, generateKey, encodeAAD, zeroFill, copyToUint8Array
      api/
        api.types.ts          # IApiAdapter interface
        supabase-client.ts    # Supabase client initialization only
        supabase-keys.ts      # Keys CRUD (getMasterKeyEnvelope, getFieldKeys, saveWrappedKey)
        supabase-fields.ts    # Fields CRUD (getField, saveField)
        supabase-recovery.ts  # Recovery data CRUD (saveRecoveryData, getRecoveryData)
        supabase-registration.ts # Registration data upload (uploadRegistrationData)
        # future: hono-client.ts
      auth/
        auth.types.ts         # IAuthAdapter interface
        auth-errors.ts        # AuthError, AuthErrorCode, isAuthError, isNetworkError
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
        crypto.types.ts       # AesGcmOptions, RecoveryWrapOptions, WrappedFieldKey, EncryptedField, etc.
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
- **Lazy-load heavy crypto modules.** `argon2-browser` (WASM, ~200KB+) and `@scure/bip39` (2048-word dictionary) must be dynamically imported via `await import(...)` only when the user is actually authenticating or recovering. Never import them at the top level of a module that loads on app startup. **Important:** always import `argon2-browser/dist/argon2-bundled.min.js`, not `argon2-browser` — the default import tries to load a `.wasm` file which Vite cannot handle; the bundled build embeds WASM as base64 in JS.
