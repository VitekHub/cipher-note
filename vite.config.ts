/// <reference types="vitest/config" />
import { readFileSync } from "node:fs"
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import { defineConfig } from "vite"

const cipherNoteIconPath = path.resolve(__dirname, "src/shared/assets/cipher-note-icon.svg")
const cipherNoteIconSource = readFileSync(cipherNoteIconPath, "utf-8")

export default defineConfig({
  base: process.env.VITE_BASE_URL || '/',
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: "./src/app/routes",
      generatedRouteTree: "./src/app/routeTree.gen.ts",
    }),
    react(),
    tailwindcss(),
    {
      name: "favicon-serve",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === "/favicon.svg") {
            res.setHeader("Content-Type", "image/svg+xml")
            res.end(cipherNoteIconSource)
            return
          }
          next()
        })
      },
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "favicon.svg",
          source: cipherNoteIconSource,
        })
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("argon2-browser")) return "crypto-argon2"
            if (id.includes("@scure/bip39")) return "crypto-bip39"
            if (id.includes("@supabase/supabase-js")) return "supabase"
            if (id.includes("react") || id.includes("react-dom"))
              return "react-vendor"
            return "vendor"
          }
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
})