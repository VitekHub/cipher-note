/// <reference types="vite/client" />

declare module 'argon2-browser/dist/argon2-bundled.min.js' {
  export * from 'argon2-browser'
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
