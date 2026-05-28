# Cipher Note

End-to-end encrypted note-taking app. The server never sees plaintext data.

## Stack

- **Build**: Vite
- **UI**: React 19 + TypeScript
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **State**: Zustand
- **Routing**: TanStack Router (file-based)
- **Data Fetching**: TanStack Query
- **i18n**: react-i18next
- **Crypto**: Web Crypto API + argon2-browser + @scure/bip39
- **Backend**: Supabase (local Docker for dev)
- **Testing**: Vitest + React Testing Library + Playwright (E2E)

## Prerequisites

- **Node.js** 20+ and **pnpm** 9+
- **Docker** (required for local Supabase — runs Postgres, Auth, Realtime, and API containers)
- **Git**

## Getting Started

```bash
# Install dependencies
pnpm install

# Start local Supabase (Docker must be running)
pnpm supabase:start

# Copy env vars (then fill in the **Publishable** anon key from supabase status output)
cp env.local.example .env.local

# Start dev server
pnpm dev

# Run tests
pnpm test

# Run tests once
pnpm test:run

# Type check
pnpm typecheck

# Build for production
pnpm build
```

`pnpm dev` runs `supabase start && vite` — it starts Supabase containers if needed, then launches the Vite dev server.

### Supabase Commands

```bash
pnpm supabase:start    # Start local Supabase containers
pnpm supabase:stop     # Stop containers (data preserved)
pnpm supabase:reset    # Reset database (re-runs migrations + seed)
pnpm supabase:status   # Show URLs and keys
pnpm dev:reset         # Reset database then start Vite
```

## Architecture

```
src/
  app/          # Application shell (providers, router, layouts, styles)
  features/     # Feature modules (auth, fields, encryption, settings)
  shared/       # Shared code (ui, crypto, api, auth, i18n, types)
```

Dependency direction: `routes -> features -> shared`. No cross-feature imports.

### App Hierarchy

```
┌────────────┐
│ index.html │
└─────┬──────┘
      ▼
┌───────────┐
│  main.tsx │──▶ i18n init
│           │──▶ Tailwind CSS
└─────┬─────┘
      ▼
┌───────────────────┐
│  AppProviders     │
│  ┌──────────────┐ │
│  │ QueryClient  │ │
│  │ ┌──────────┐ │ │
│  │ │  Auth    │ │ │
│  │ │ ┌──────┐ │ │ │
│  │ │ │Router│ │ │ │
│  │ │ └──┬───┘ │ │ │
│  │ └────┬─────┘ │ │
│  └──────┼───────┘ │
└─────────┼─────────┘
          ▼
    ┌────────────┐
    │  __root    │──▶ ThemeProvider + Toaster
    └─────┬──────┘
      ┌───┴───┐
      ▼       ▼
  _public   _authenticated
  (guest)   (logged in)
      │       │
      ▼       ▼
  /login    /dashboard
  /register /settings
  /recover
```

## Project Conventions

- **No barrel files (index.ts)**. Import directly by path: `import { Button } from '@/shared/ui/button'`
- **Target 100-200 lines per file, max 300**. Split large files into focused modules.
- **Dark theme is the default**. The `<html>` element has `class="dark"`.
- **Lazy-load heavy crypto modules**. `argon2-browser` and `@scure/bip39` are dynamically imported, never top-level.
- **Each shadcn component in its own file**. No index.ts in shared/ui. Custom components are organized into subdirectories: `brand/`, `nav/`, `form/`.
- **Types in separate `.types.ts` files**. Keep type definitions separate from implementation.
- **Tests are colocated with code**. `button.tsx` -> `button.test.tsx` in the same directory.
- **File naming**. React components use PascalCase (`LoginPage.tsx`, `FormField.tsx`). Utilities, hooks, schemas, and types use kebab-case (`auth-store.ts`, `login-schema.ts`). shadcn/ui primitives stay kebab-case as generated (`button.tsx`, `card.tsx`, `skeleton.tsx`).

## Environment Variables

Copy `env.local.example` to `.env.local` and fill in values:

```bash
cp env.local.example .env.local
```

After running `pnpm supabase:start`, copy the **Publishable** key from the output into `.env.local` as `VITE_SUPABASE_ANON_KEY`.

## License

MIT