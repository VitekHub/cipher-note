-- ============================================
-- Cipher Note: Username Availability Check
-- ============================================
-- Provides a rate-limited RPC function that lets
-- unauthenticated users check if a username is
-- available before signing up.
--
-- SECURITY DEFINER is required so the anon role
-- can query public.users, bypassing the RLS
-- policy that restricts SELECT to id = auth.uid().
--
-- Rate limiting uses an advisory-lock + counter
-- table (fixed-window). One row per IP, no
-- cleanup jobs needed, O(1) per request.
-- If abuse becomes a concern, consider adding
-- a db_pre_request hook for broader protection
-- or enabling Edge Functions with Upstash Redis.

-- Private schema for internal tables not exposed via API
CREATE SCHEMA IF NOT EXISTS private;

-- Rate limit counter table (private schema, not exposed via API)
CREATE TABLE private.rate_limits (
  key          TEXT PRIMARY KEY,
  count        INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL
);

-- Rate limit check using advisory lock for concurrency safety
CREATE OR REPLACE FUNCTION private.check_rate_limit(
  p_key TEXT,
  p_max_requests INTEGER DEFAULT 10,
  p_window_seconds INTEGER DEFAULT 120
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  now_val TIMESTAMPTZ := clock_timestamp();
  window_length INTERVAL := make_interval(secs => p_window_seconds);
  current_count INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_key));

  INSERT INTO private.rate_limits (key, count, window_start)
  VALUES (p_key, 1, now_val)
  ON CONFLICT (key) DO UPDATE
  SET count = CASE
                WHEN rate_limits.window_start + window_length <= now_val
                  THEN 1
                  ELSE rate_limits.count + 1
              END,
      window_start = CASE
                       WHEN rate_limits.window_start + window_length <= now_val
                         THEN now_val
                         ELSE rate_limits.window_start
                     END;

  SELECT count INTO current_count FROM private.rate_limits WHERE key = p_key;

  IF current_count > p_max_requests THEN
    RAISE EXCEPTION 'Rate limit exceeded. Try again in a few minutes.';
  END IF;
END;
$$;

-- Username availability check (public, callable by anon)
-- Declared VOLATILE (not STABLE) so PostgREST only accepts POST,
-- which is required for write-path rate limiting.
CREATE OR REPLACE FUNCTION public.check_username_availability(p_username TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  req_ip text;
  rate_key text;
  username_taken boolean;
BEGIN
  -- Validate format first (fail fast, don't waste rate limit budget)
  IF p_username IS NULL OR p_username !~ '^[a-zA-Z0-9_]{3,32}$' THEN
    RETURN FALSE;
  END IF;

  -- Extract client IP from x-forwarded-for header.
  -- inet_client_addr() returns the proxy IP, not the client.
  req_ip := COALESCE(
    split_part(
      current_setting('request.headers', true)::json->>'x-forwarded-for',
      ',', 1
    ),
    '0.0.0.0'
  );

  -- Rate limit: 10 checks per 2 minutes per IP
  rate_key := 'username_check:' || req_ip;
  PERFORM private.check_rate_limit(rate_key, 10, 120);

  -- Case-insensitive existence check. Leverages the existing
  -- idx_users_username index on LOWER(username) for O(1) lookup.
  SELECT EXISTS(
    SELECT 1 FROM public.users WHERE LOWER(username) = LOWER(p_username)
  ) INTO username_taken;

  RETURN NOT username_taken;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_username_availability(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_username_availability(TEXT) TO authenticated;
