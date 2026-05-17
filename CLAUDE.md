# CLAUDE.md — Project Instructions for Claude Code

## Project Overview

Cipher Note is an end-to-end encrypted note-taking app built with Vite + React + TypeScript. Each user has three encrypted fields (note, website, email) protected by a layered key hierarchy. The server never sees plaintext data.

## Key Conventions

### File Organization
- `src/app/` — Application shell (providers, router, layouts, styles, routes)
- `src/features/` — Feature modules, each with `model/`, `ui/`, and optionally `lib/`
- `src/shared/` — Shared code (ui components, crypto, api adapters, auth, i18n, types)
- Dependency direction: `routes -> features -> shared`. NEVER import from features into shared, or from one feature into another.

### No Barrel Files
- NEVER create `index.ts` barrel files in any directory.
- Always import directly by path: `import { Button } from '@/shared/ui/button'`
- This applies to ALL directories: `shared/ui/`, `shared/crypto/`, `shared/auth/`, etc.

### File Size
- Target 100-200 lines per file. Maximum 300 lines.
- If a file exceeds 300 lines, split it.
- Prefer deep folder hierarchies over wide shallow files.

### Testing
- Tests are colocated with source: `aes-gcm.ts` -> `aes-gcm.test.ts` in the same directory.
- No separate `__tests__/` folders.
- Use the custom `render` from `@/test/utils` which wraps components with ThemeProvider.
- Use `vitest` globals (`describe`, `it`, `expect`) — enabled in vitest config.

### Crypto Security
- NEVER import `argon2-browser` or `@scure/bip39` at the top level of any module that loads on app startup.
- These MUST be dynamically imported: `const argon2 = await import('argon2-browser')`
- The Vite config already has manual chunks for these modules to keep them out of the initial bundle.
- NEVER persist crypto keys to localStorage, sessionStorage, or IndexedDB.
- Use hex-encoded strings in Zustand stores (not Uint8Array or Map) for proper reactivity.

### Styling
- Tailwind CSS v4 with `@import "tailwindcss"` and `@theme` in `src/app/styles/globals.css`.
- Dark theme is default. The `<html>` element has `class="dark"`.
- Use shadcn/ui components from `@/shared/ui/`.
- When adding new shadcn components: `npx shadcn@latest add <component>` and they go to `src/shared/ui/`.
- Always use the `cn()` utility from `@/shared/lib/utils` for conditional classes.

### Import Paths
- `@/*` resolves to `src/*`.
- Example: `import { Button } from '@/shared/ui/button'`
- Example: `import { useAuthStore } from '@/features/auth/model/auth-store'`

### Path Aliases in TypeScript
- Path aliases are configured in `tsconfig.app.json` with `"ignoreDeprecations": "6.0"` for TS 6 compatibility.
- When adding a new alias, update `tsconfig.app.json` AND `vite.config.ts`.

### State Management
- Zustand for client state (auth store, crypto store, UI store).
- TanStack Query for server state (fields, keys).
- NEVER store `language` preference in Zustand — `i18next` is the source of truth.

### Code Style
- Use TypeScript strict mode.
- Use named exports (no default exports except for page/route components and React components).
- Use `function` declarations for React components, not arrow functions assigned to `const`.
- Always define components OUTSIDE other components (no inline component definitions).
- Use statically analyzable import paths (no template literal imports).

## Development Commands

```bash
pnpm dev          # Start dev server
pnpm build        # Type check + build
pnpm test         # Run tests in watch mode
pnpm test:run     # Run tests once
pnpm typecheck    # Type check only
pnpm lint         # Run ESLint
```

## Current Progress

See `IMPLEMENTATION-PLAN.md` for the full 36-step plan.
- Step 1 (Project Scaffolding + UI Foundation) — complete
- Step 2 (i18n Setup) — complete
- Step 3 (Router + Route Structure + Suspense Boundaries) — complete
- Step 4 (State Management + Adapter Interfaces) — complete

### Router Setup (Step 3)
- TanStack Router with file-based routing (`@tanstack/router-plugin` + `autoCodeSplitting`)
- Route files in `src/app/routes/` using `createFileRoute`
- Auto-generated `src/app/routeTree.gen.ts` (committed to git)
- Pathless layout routes: `_public` (PublicLayout) and `_authenticated` (ProtectedLayout + auth guard)
- Auth guards via `beforeLoad` with placeholder `AuthContext` (`isAuthenticated: false`)
- Suspense boundaries at every route level with `PageSkeleton`, `AuthPageSkeleton`, `DashboardSkeleton`
- Error boundary with `CryptoError`, `DecryptionError`, `CorruptedDataError` classes
- Test setup includes i18n initialization with all locale resources

### State Management (Step 4)
- Zustand stores: `useAuthStore` (auth state), `useCryptoStore` (in-memory keys, hex-encoded strings), `useUiStore` (sidebar, active field)
- TanStack Query: `QueryClientProvider` in `src/app/providers.tsx`, exported `queryClient` for vault lock cache purging
- Adapter interfaces: `IAuthAdapter`, `IApiAdapter`, `IRealtimeAdapter` in `shared/auth/`, `shared/api/`, `shared/realtime/`
- Shared types: `crypto.types.ts`, `api.types.ts`, entity types (`user.types.ts`, `field.types.ts`, `key.types.ts`)
- AuthContext reads from Zustand auth store (single source of truth) and bridges to TanStack Router context
- Crypto store uses hex strings for keys (not Uint8Array/Map) for proper Zustand reactivity
- UI store uses `persist` middleware for `sidebarOpen`; auth and crypto stores never persist