-- ============================================
-- Cipher Note: Table Creation
-- ============================================

-- Custom enum type for the encrypted field names
CREATE TYPE public.field_name AS ENUM ('title', 'note', 'website', 'email');

-- ============================================
-- Users profile table
-- Mirrors auth.users via trigger (see 00003_functions.sql)
-- ============================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL CHECK (username ~ '^[a-zA-Z0-9_]{3,32}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_users_username ON public.users (LOWER(username));

-- ============================================
-- Login salts table (one-to-one with user)
-- Stores salts for the split KDF (pre-auth, accessible via RPC by anon)
-- ============================================
CREATE TABLE public.login_salts (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  kdf_salt TEXT NOT NULL CHECK (length(kdf_salt) = 32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- Master keys table (one-to-one with user)
-- Stores wrapped master key envelope (post-auth, protected by RLS)
-- ============================================
CREATE TABLE public.master_keys (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  wrapped_master_key TEXT NOT NULL CHECK (length(wrapped_master_key) = 96),
  master_key_iv TEXT NOT NULL CHECK (length(master_key_iv) = 24),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- Field keys table (one-to-many with user)
-- Each field has a versioned wrapped key for key rotation
-- ============================================
CREATE TABLE public.field_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  field_name public.field_name NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  wrapped_field_key TEXT NOT NULL CHECK (length(wrapped_field_key) = 96),
  field_key_iv TEXT NOT NULL CHECK (length(field_key_iv) = 24),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, field_name, version)
);

CREATE INDEX idx_field_keys_user_field ON public.field_keys (user_id, field_name);
-- Note: The UNIQUE(user_id, field_name, version) constraint also provides an index
-- for queries filtering by (user_id, field_name), so this explicit index is redundant
-- for lookups but keeps the index naming consistent with encrypted_fields.

-- ============================================
-- Entries table (one-to-many with user)
-- Each entry is a group of encrypted fields (title, note, website, email).
-- No encrypted data lives here — only metadata and timestamps.
-- ============================================
CREATE TABLE public.entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_entries_user ON public.entries (user_id);

-- ============================================
-- Encrypted fields table (one per field per entry)
-- Stores the encrypted content blob for each field.
-- user_id is denormalized from entries for simple RLS policies:
-- USING (user_id = auth.uid()) avoids a JOIN on every policy check.
-- ============================================
CREATE TABLE public.encrypted_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  field_name public.field_name NOT NULL,
  ciphertext TEXT NOT NULL CHECK (length(ciphertext) >= 32),
  ciphertext_iv TEXT NOT NULL CHECK (length(ciphertext_iv) = 24),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entry_id, field_name)
);

CREATE INDEX idx_encrypted_fields_entry ON public.encrypted_fields (entry_id);

-- ============================================
-- Recovery keys table (one-to-one with user)
-- Stores BIP-39 mnemonic-wrapped master key for account recovery
-- ============================================
CREATE TABLE public.recovery_keys (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  recovery_key_salt TEXT NOT NULL CHECK (length(recovery_key_salt) = 32),
  recovery_wrapped_master_key TEXT NOT NULL CHECK (length(recovery_wrapped_master_key) = 96),
  recovery_key_iv TEXT NOT NULL CHECK (length(recovery_key_iv) = 24),
  recovery_auth_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
