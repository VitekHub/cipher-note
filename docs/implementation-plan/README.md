# Cipher Note React — Implementation Plan

## Overview

This is the implementation plan for Cipher Note, an end-to-end encrypted note-taking app. The plan is split into 9 phases across 36 steps.

**See also:**
- [00-overview.md](./00-overview.md) — App summary, decisions, architecture notes, project structure
- [01-phase-1-foundation.md](./01-phase-1-foundation.md) — Project scaffolding, i18n, router, state, Supabase
- [02-phase-2-auth.md](./02-phase-2-auth.md) — Supabase Auth, register/login UI, auth state
- [03-phase-3-dashboard.md](./03-phase-3-dashboard.md) — Responsive layout, field cards, settings shell
- [04-phase-4-crypto.md](./04-phase-4-crypto.md) — AES-GCM, key wrapping, Argon2id, HKDF, key hierarchy, Split KDF, BIP-39
- [05-phase-5-reg-login.md](./05-phase-5-reg-login.md) — Registration/login flows, vault unlock, crypto store
- [06-phase-6-data.md](./06-phase-6-data.md) — API adapter, field encrypt/decrypt, auto-save
- [07-phase-7-realtime.md](./07-phase-7-realtime.md) — Supabase Realtime, conflict resolution
- [08-phase-8-recovery.md](./08-phase-8-recovery.md) — Change password, seed phrase view/recovery, key rotation
- [09-phase-9-polish.md](./09-phase-9-polish.md) — Mobile, UX polish, security hardening, E2E tests

---

## Phase Summary

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

---

## Current Progress

- [x] Step 1 — Project Scaffolding + UI Foundation
- [x] Step 2 — i18n Setup
- [x] Step 3 — Router + Route Structure + Suspense Boundaries
- [x] Step 4 — State Management + Adapter Interfaces
- [x] Step 5 — Supabase Local Setup + Database Schema
- [x] Step 6 — Supabase Auth Adapter + Username Auth
- [x] Step 7 — Auth UI: Register + Login Pages
- [x] Step 8 — Auth State + Protected Routes
- [x] Step 9 — Dashboard Layout (Responsive)
- [x] Step 10 — Dashboard Page Shell + Field Components
- [x] Step 11 — Settings Page Shell
- [x] Step 12 — AES-256-GCM Encrypt/Decrypt
- [x] Step 13 — Key Wrapping/Unwrapping
- [x] Step 14 — Argon2id Key Derivation
- [x] Step 15 — HKDF Key Derivation + Key Hierarchy
- [x] Step 16 — Split KDF Module
- [x] Step 17 — BIP-39 Mnemonic Module
- [x] Step 18 — Crypto Integration Tests
- [x] Step 19 — Registration Crypto Flow
- [x] Step 20 — Registration UI
- [x] Step 21 — Login Crypto Flow
- [x] Step 22 — Login UI + Vault Unlock
- [x] Step 23 — Non-Extractable Key Vault + Zustand Store Refactor
- [x] Step 24 — Supabase API Adapter
- [x] Step 25 — Encrypted Field CRUD
- [x] Step 26 — Auto-Save + Sync Flow
- [x] Step 27 — Supabase Realtime Adapter
- [x] Step 28 — Multi-Device Session Handling
- [x] Step 29 — Change Password Flow + UI
- [x] Step 30 — Seed Phrase Backup View
- [x] Step 31 — Seed Phrase Recovery Flow + UI
- [x] Step 32 — Key Rotation + UI
- [x] Step 33 — Mobile Responsive Refinements
- [ ] Step 34 — Loading States, Error Boundaries, Toast Notifications
- [ ] Step 35 — Security Hardening
- [ ] Step 36 — E2E Tests (Playwright)

---

## Implementation Notes

Each step is designed to be implementable in under a day. Crypto steps (12–18) may run closer to a full day due to the precision required. UI steps (9–11, 20, 22) should be faster. The plan is ordered UI-first so you see visual progress early, with crypto foundation coming before the data layer that depends on it.
