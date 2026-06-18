-- ============================================
-- Cipher Note: Row Level Security Policies
-- ============================================

-- Revoke default Supabase privileges from anon on all tables.
-- anon never needs direct table access — it only uses SECURITY DEFINER
-- RPC functions with explicit GRANT EXECUTE (check_username_availability,
-- get_login_salts). Revoking prevents table schemas from appearing in the
-- public GraphQL/REST API.
-- authenticated retains table access (needed for supabase.from() queries,
-- with RLS restricting rows to user_id = auth.uid()).
REVOKE ALL ON public.users FROM anon;
REVOKE ALL ON public.keys FROM anon;
REVOKE ALL ON public.field_keys FROM anon;
REVOKE ALL ON public.entries FROM anon;
REVOKE ALL ON public.encrypted_fields FROM anon;
REVOKE ALL ON public.recovery FROM anon;

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encrypted_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Users policies
-- Users can view and update their own profile.
-- INSERT is handled by the database trigger (on_auth_user_created),
-- not by client code, so no INSERT policy is needed.
-- ============================================
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================
-- Keys policies (one-to-one with user)
-- ============================================
CREATE POLICY "Users can view own keys"
  ON public.keys FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own keys"
  ON public.keys FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own keys"
  ON public.keys FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- Field keys policies (one-to-many with user)
-- Key rotation requires INSERT (new version) and DELETE (old cleanup)
-- ============================================
CREATE POLICY "Users can view own field keys"
  ON public.field_keys FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own field keys"
  ON public.field_keys FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own field keys"
  ON public.field_keys FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own field keys"
  ON public.field_keys FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- Entries policies (one-to-many with user)
-- Entries are first-class entities — create and delete operations
-- target entries, and ON DELETE CASCADE propagates to encrypted_fields.
-- ============================================
CREATE POLICY "Users can view own entries"
  ON public.entries FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own entries"
  ON public.entries FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own entries"
  ON public.entries FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own entries"
  ON public.entries FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- Encrypted fields policies (one per field per entry)
-- Upsert logic uses INSERT + UPDATE; DELETE for field removal
-- user_id is denormalized from entries for simple RLS policies
-- ============================================
CREATE POLICY "Users can view own encrypted fields"
  ON public.encrypted_fields FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own encrypted fields"
  ON public.encrypted_fields FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own encrypted fields"
  ON public.encrypted_fields FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own encrypted fields"
  ON public.encrypted_fields FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- Recovery policies (one-to-one with user)
-- No DELETE policy: recovery data can be replaced (UPDATE) but never removed.
-- This ensures users always have a recovery path available.
-- ============================================
CREATE POLICY "Users can view own recovery data"
  ON public.recovery FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own recovery data"
  ON public.recovery FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own recovery data"
  ON public.recovery FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- Realtime publication
-- Enable postgres_changes broadcasting for the client-side sync tables so
-- remote edits (another device/session) can be reflected live. Realtime
-- respects RLS: a subscriber only receives rows it can SELECT, i.e. rows
-- matching user_id = auth.uid() (the SELECT policies above). No per-channel
-- filter is needed — RLS already scopes events to the current user.
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.encrypted_fields;
ALTER PUBLICATION supabase_realtime ADD TABLE public.entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.field_keys;
