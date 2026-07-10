-- ============================================
-- Cipher Note: Session Management RPCs
-- ============================================
-- SECURITY DEFINER RPCs for managing user sessions.
-- These functions allow authenticated users to:
--   1. List their active sessions (browser, IP, last active time)
--   2. Revoke a specific session (cannot revoke the current session)
--   3. Revoke all sessions except the current one
--   4. Check whether the current session is still valid
--
-- The auth.sessions table is in the auth schema (not accessible to the
-- anon or authenticated roles directly), so these functions run as
-- SECURITY DEFINER to bypass RLS.
-- ============================================

-- RPC to list active sessions for the current user.
-- Returns display-safe columns only (no internal data like refresh tokens).
CREATE OR REPLACE FUNCTION public.get_active_sessions()
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  user_agent TEXT,
  ip TEXT,
  not_after TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
    SELECT s.id, s.created_at, s.updated_at, s.user_agent, s.ip::TEXT, s.not_after
    FROM auth.sessions s
    WHERE s.user_id = auth.uid()
    ORDER BY s.updated_at DESC;
END;
$$;

-- RPC to revoke a specific session by ID.
-- Prevents self-revocation by checking the session_id claim in the JWT.
-- Returns TRUE if the session was found and deleted, FALSE otherwise.
CREATE OR REPLACE FUNCTION public.revoke_session(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_session_id UUID;
  v_deleted BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Extract the current session ID from the JWT to prevent self-revocation.
  v_current_session_id := (current_setting('request.jwt.claims', true)::json ->> 'session_id')::UUID;

  IF p_session_id = v_current_session_id THEN
    RAISE EXCEPTION 'Cannot revoke current session';
  END IF;

  DELETE FROM auth.sessions
    WHERE id = p_session_id AND user_id = auth.uid();

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- RPC to revoke all sessions except the current one.
-- The current session is identified by the session_id claim in the JWT.
-- Returns the number of sessions revoked.
CREATE OR REPLACE FUNCTION public.revoke_other_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_current_session_id UUID;
  v_revoked_count INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Extract the current session ID from the JWT.
  v_current_session_id := (current_setting('request.jwt.claims', true)::json ->> 'session_id')::UUID;

  DELETE FROM auth.sessions
    WHERE user_id = v_user_id
      AND id != COALESCE(v_current_session_id, '00000000-0000-0000-0000-000000000000'::UUID);

  GET DIAGNOSTICS v_revoked_count = ROW_COUNT;
  RETURN v_revoked_count;
END;
$$;

-- RPC to check whether the current session is still valid.
-- Returns FALSE if the session has been revoked or the user is not authenticated.
-- Used by the client to detect cross-device session revocation.
CREATE OR REPLACE FUNCTION public.is_session_valid()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_session_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  v_current_session_id := (current_setting('request.jwt.claims', true)::json ->> 'session_id')::UUID;

  RETURN EXISTS (
    SELECT 1 FROM auth.sessions
    WHERE id = v_current_session_id AND user_id = auth.uid()
  );
END;
$$;

-- ============================================
-- Privileges: revoke default grants, then grant authenticated-only access
-- ============================================

REVOKE ALL ON FUNCTION public.get_active_sessions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_active_sessions() FROM anon;
REVOKE ALL ON FUNCTION public.revoke_session(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_session(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.revoke_other_sessions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_other_sessions() FROM anon;
REVOKE ALL ON FUNCTION public.is_session_valid() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_session_valid() FROM anon;

GRANT EXECUTE ON FUNCTION public.get_active_sessions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_other_sessions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_session_valid() TO authenticated;
