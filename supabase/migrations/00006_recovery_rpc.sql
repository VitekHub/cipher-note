-- ============================================
-- Cipher Note: Recovery RPC Functions
-- ============================================
-- Three SECURITY DEFINER RPCs for the account recovery flow:
--
-- 1. get_recovery_data — pre-auth, rate-limited (5 req/2 min/IP)
--    Returns recovery key salt, wrapped master key, and IV by username
--    so the client can derive the recovery KEK and attempt to unwrap.
--
-- 2. recover_account — pre-auth, rate-limited (3 req/15 min/IP)
--    Atomically verifies the recovery proof (bcrypt of recoveryAuthHash),
--    then updates auth password, login_salts, and master_keys in a single
--    transaction. Returns the user ID so the client can log in.
--
-- 3. save_recovery_data — authenticated only
--    Upserts recovery keys for a user, applying crypt() to
--    recoveryAuthHash before storage. Ensures the raw HKDF-derived
--    value never appears in the DB.
--
-- All three use the private.check_rate_limit infrastructure from
-- 00004_username_availability.sql.

-- ============================================
-- Pre-auth: fetch recovery data by username
-- ============================================
CREATE OR REPLACE FUNCTION public.get_recovery_data(p_username TEXT)
RETURNS TABLE(recovery_key_salt TEXT, recovery_wrapped_master_key TEXT, recovery_key_iv TEXT)
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
  rate_key := 'recovery_data:' || req_ip;
  PERFORM private.check_rate_limit(rate_key, 5, 120);

  RETURN QUERY
    SELECT rk.recovery_key_salt, rk.recovery_wrapped_master_key, rk.recovery_key_iv
    FROM public.recovery_keys rk
    JOIN public.users u ON rk.user_id = u.id
    WHERE LOWER(u.username) = LOWER(p_username);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recovery data not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_recovery_data(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_recovery_data(TEXT) TO authenticated;

-- ============================================
-- Pre-auth: atomic account recovery
-- Verifies recoveryAuthHash against stored bcrypt hash, then
-- updates auth password, login_salts, and master_keys in a
-- single transaction. Rate-limited to 3 requests per 15
-- minutes per IP to prevent brute-force abuse.
-- ============================================
CREATE OR REPLACE FUNCTION public.recover_account(
  p_username TEXT,
  p_recovery_auth_hash TEXT,
  p_new_auth_hash TEXT,
  p_new_kdf_salt TEXT,
  p_new_wrapped_master_key TEXT,
  p_new_master_key_iv TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id UUID;
  v_stored_hash TEXT;
  req_ip text;
  rate_key text;
BEGIN
  -- Validate format (fail fast)
  IF p_username IS NULL OR p_username !~ '^[a-zA-Z0-9_]{3,32}$' THEN
    RAISE EXCEPTION 'Invalid username format';
  END IF;

  -- Rate limit: 3 attempts per 15 minutes per IP (stricter than login)
  req_ip := COALESCE(
    split_part(
      current_setting('request.headers', true)::json->>'x-forwarded-for',
      ',', 1
    ),
    '0.0.0.0'
  );
  rate_key := 'recover_account:' || req_ip;
  PERFORM private.check_rate_limit(rate_key, 3, 900);

  -- Look up user by username
  SELECT id INTO v_user_id FROM public.users WHERE LOWER(username) = LOWER(p_username);
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Verify recoveryAuthHash against stored bcrypt hash (proves mnemonic knowledge)
  SELECT recovery_auth_hash INTO v_stored_hash FROM public.recovery_keys WHERE user_id = v_user_id;
  IF v_stored_hash IS NULL THEN
    RAISE EXCEPTION 'Recovery data not found';
  END IF;

  IF crypt(p_recovery_auth_hash, v_stored_hash) != v_stored_hash THEN
    RAISE EXCEPTION 'Invalid recovery proof';
  END IF;

  -- Verify user has login_salts and master_keys rows (defensive)
  IF NOT EXISTS (SELECT 1 FROM public.login_salts WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'Login data not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.master_keys WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'Master key data not found';
  END IF;

  -- All updates in a single transaction (function-level guarantee)
  -- 1. Update auth password
  UPDATE auth.users SET encrypted_password = crypt(p_new_auth_hash, gen_salt('bf'))
    WHERE id = v_user_id;

  -- 2. Update login_salts
  UPDATE public.login_salts SET kdf_salt = p_new_kdf_salt WHERE user_id = v_user_id;

  -- 3. Update master_keys
  UPDATE public.master_keys
    SET wrapped_master_key = p_new_wrapped_master_key, master_key_iv = p_new_master_key_iv
    WHERE user_id = v_user_id;

  RETURN v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recover_account(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.recover_account(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================
-- Authenticated: save recovery data with bcrypt-hashed auth proof
-- Upserts recovery keys for an authenticated user, applying
-- crypt() to the recovery_auth_hash before storage.
-- This ensures the raw HKDF-derived value never appears in the DB.
-- ============================================
CREATE OR REPLACE FUNCTION public.save_recovery_data(
  p_user_id UUID,
  p_recovery_key_salt TEXT,
  p_recovery_wrapped_master_key TEXT,
  p_recovery_key_iv TEXT,
  p_recovery_auth_hash TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO public.recovery_keys (user_id, recovery_key_salt, recovery_wrapped_master_key, recovery_key_iv, recovery_auth_hash)
  VALUES (
    p_user_id,
    p_recovery_key_salt,
    p_recovery_wrapped_master_key,
    p_recovery_key_iv,
    crypt(p_recovery_auth_hash, gen_salt('bf'))
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    recovery_key_salt = EXCLUDED.recovery_key_salt,
    recovery_wrapped_master_key = EXCLUDED.recovery_wrapped_master_key,
    recovery_key_iv = EXCLUDED.recovery_key_iv,
    recovery_auth_hash = EXCLUDED.recovery_auth_hash;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_recovery_data(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
