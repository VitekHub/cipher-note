-- ============================================
-- Cipher Note: Table Creation
-- ============================================

-- Custom enum type for the three encrypted field names
CREATE TYPE public.field_name AS ENUM ('note', 'website', 'email');

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
-- Keys table (one-to-one with user)
-- Stores key hierarchy material: salts and wrapped master key
-- ============================================
CREATE TABLE public.keys (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  auth_salt TEXT NOT NULL CHECK (length(auth_salt) = 64),
  key_salt TEXT NOT NULL CHECK (length(key_salt) = 64),
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
  wrapped_key TEXT NOT NULL CHECK (length(wrapped_key) = 96),
  key_iv TEXT NOT NULL CHECK (length(key_iv) = 24),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, field_name, version)
);

CREATE INDEX idx_field_keys_user_field ON public.field_keys (user_id, field_name);
-- Note: The UNIQUE(user_id, field_name, version) constraint also provides an index
-- for queries filtering by (user_id, field_name), so this explicit index is redundant
-- for lookups but keeps the index naming consistent with encrypted_fields.

-- ============================================
-- Encrypted fields table (one per field per user)
-- Stores the encrypted content blob for each field
-- ============================================
CREATE TABLE public.encrypted_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  field_name public.field_name NOT NULL,
  encrypted_blob TEXT NOT NULL CHECK (length(encrypted_blob) >= 32),
  iv TEXT NOT NULL CHECK (length(iv) = 24),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, field_name)
);

CREATE INDEX idx_encrypted_fields_user ON public.encrypted_fields (user_id);

-- ============================================
-- Recovery table (one-to-one with user)
-- Stores BIP-39 mnemonic-wrapped master key for account recovery
-- ============================================
CREATE TABLE public.recovery (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  recovery_salt TEXT NOT NULL CHECK (length(recovery_salt) = 64),
  wrapped_master_key TEXT NOT NULL CHECK (length(wrapped_master_key) = 96),
  recovery_iv TEXT NOT NULL CHECK (length(recovery_iv) = 24),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
