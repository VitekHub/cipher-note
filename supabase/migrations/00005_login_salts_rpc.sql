-- ============================================
-- Cipher Note: Login Salts RPC
-- ============================================
-- Provides a SECURITY DEFINER function that lets
-- unauthenticated users fetch their auth_salt and
-- key_salt by username. These salts are not secrets --
-- they are comparable to password salts in traditional
-- auth systems and must be accessible before login to
-- derive the authHash for Supabase Auth.
--
-- Rate limited using the existing private.rate_limits
-- infrastructure (5 requests per 2 minutes per IP).

CREATE OR REPLACE FUNCTION public.get_login_salts(p_username TEXT)
RETURNS TABLE(auth_salt TEXT, key_salt TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  req_ip text;
  rate_key text;
BEGIN
  -- Validate format (fail fast, don't waste rate limit budget)
  IF p_username IS NULL OR p_username !~ '^[a-zA-Z0-9_]{3,32}$' THEN
    RAISE EXCEPTION 'Invalid username format';
  END IF;

  -- Rate limit: 5 attempts per 2 minutes per IP
  req_ip := COALESCE(
    split_part(
      current_setting('request.headers', true)::json->>'x-forwarded-for',
      ',', 1
    ),
    '0.0.0.0'
  );
  rate_key := 'login_salts:' || req_ip;
  PERFORM private.check_rate_limit(rate_key, 5, 120);

  RETURN QUERY
    SELECT k.auth_salt, k.key_salt
    FROM public.keys k
    JOIN public.users u ON k.user_id = u.id
    WHERE LOWER(u.username) = LOWER(p_username);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_login_salts(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_login_salts(TEXT) TO authenticated;