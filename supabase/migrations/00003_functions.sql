-- ============================================
-- Cipher Note: Database Functions and Triggers
-- ============================================

-- Helper function: get current user ID from auth context
-- Used by application code for RLS-aware queries
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT auth.uid();
$$;

-- ============================================
-- Trigger: Auto-create user profile on signup
-- When a new user is created in auth.users (via supabase.auth.signUp),
-- automatically create a corresponding row in public.users.
-- SECURITY DEFINER is required so the trigger can INSERT into public.users
-- even though the calling context is the anon role (which RLS would block).
--
-- The username is extracted from raw_user_meta_data (set during signup)
-- with a fallback to the local part of the email (for the
-- {username}@ciphernote.internal mapping). The CHECK constraint on
-- public.users.username (^[a-zA-Z0-9_]{3,32}$) will cause this INSERT
-- to fail — and roll back the auth.users creation — if the username
-- doesn't match the required format.
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, username, created_at)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(NEW.created_at, pg_catalog.now())
  );
  RETURN NEW;
END;
$$;

-- Fire the trigger after every INSERT on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- Trigger: Auto-update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_login_salts_updated_at
  BEFORE UPDATE ON public.login_salts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_master_keys_updated_at
  BEFORE UPDATE ON public.master_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_field_keys_updated_at
  BEFORE UPDATE ON public.field_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_entries_updated_at
  BEFORE UPDATE ON public.entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_encrypted_fields_updated_at
  BEFORE UPDATE ON public.encrypted_fields
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recovery_keys_updated_at
  BEFORE UPDATE ON public.recovery_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Revoke default EXECUTE grants on internal functions.
-- Trigger and utility functions should not be callable via REST/RPC.
-- ============================================
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.get_current_user_id() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
