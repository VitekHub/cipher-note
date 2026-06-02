# Phase 3: Dashboard & Layout ✅

## Step 9 — Dashboard Layout (Responsive) ✅

**Goal:** Responsive dashboard layout with sidebar, header, and main content area.

**Code:**
- `src/app/layouts/ProtectedLayout.tsx`:
  - Desktop: resizable sidebar (default 240px, range 150–1000px, persisted to localStorage) + header + scrollable main content
  - Mobile: bottom navigation bar, collapsible hamburger menu (fixed 240px Sheet, not resizable)
  - Sidebar: app logo, nav links (Dashboard, Settings), user info, lock vault button, language switcher
  - Header: page title, vault lock/unlock indicator
- `src/shared/ui/brand/AppLogo.tsx`
- `src/app/layouts/Sidebar.tsx` — responsive sidebar component, shared between desktop aside and mobile Sheet overlay, with optional `onClose` prop for closing the Sheet on navigation
- `src/app/layouts/MobileNav.tsx` — bottom navigation for mobile with vault toggle center button
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

## Step 10 — Dashboard Page Shell + Field Components ✅

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

## Step 11 — Settings Page Shell ✅

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
- `useAuth()` context hook in `src/shared/auth/auth-context.tsx` provides `user` — features access current user data without cross-feature imports from auth store
- Add i18n strings to `settings.json` (including `languageName.en/cs` for full variant labels)

**Tests:**
- Component tests: SettingsPage renders all sections
- Component tests: language switcher changes app language (both variants)
- Component test: security section links are present
