-- ============================================
-- Cipher Note: Delete Account RPC
-- ============================================
-- A SECURITY DEFINER RPC that deletes the calling user's account
-- and all associated data. The DELETE on auth.users cascades through
-- all public tables (users, login_salts, master_keys, field_keys,
-- entries, encrypted_fields, recovery_keys) via ON DELETE CASCADE
-- foreign keys.
--
-- The function is authenticated-only (GRANT to authenticated role).
-- The client must verify the user's password before calling this RPC
-- to prevent accidental deletion from an unlocked session.
-- ============================================

CREATE OR REPLACE FUNCTION public.delete_account()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM auth.users WHERE id = v_user_id;
END;
$$;

-- Revoke default PUBLIC grant (Supabase grants EXECUTE to PUBLIC by default)
-- so that only authenticated users can call this function.
REVOKE ALL ON FUNCTION public.delete_account() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_account() FROM anon;

GRANT EXECUTE ON FUNCTION public.delete_account() TO authenticated;
