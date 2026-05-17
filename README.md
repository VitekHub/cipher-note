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

## Getting Started

```bash
# Install dependencies
pnpm install

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

## Architecture

```
src/
  app/          # Application shell (providers, router, layouts, styles)
  features/     # Feature modules (auth, fields, encryption, settings)
  shared/       # Shared code (ui, crypto, api, auth, i18n, types)
```

Dependency direction: `routes -> features -> shared`. No cross-feature imports.

## Project Conventions

- **No barrel files (index.ts)**. Import directly by path: `import { Button } from '@/shared/ui/button'`
- **Target 100-200 lines per file, max 300**. Split large files into focused modules.
- **Dark theme is the default**. The `<html>` element has `class="dark"`.
- **Lazy-load heavy crypto modules**. `argon2-browser` and `@scure/bip39` are dynamically imported, never top-level.
- **Each shadcn component in its own file**. No index.ts in shared/ui.
- **Types in separate `.types.ts` files**. Keep type definitions separate from implementation.
- **Tests are colocated with code**. `button.tsx` -> `button.test.tsx` in the same directory.

## Environment Variables

Copy `env.local.example` to `.env.local` and fill in values:

```bash
cp env.local.example .env.local
```

## License

Private