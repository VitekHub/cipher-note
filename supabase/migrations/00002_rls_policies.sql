-- ============================================
-- Cipher Note: Row Level Security Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_keys ENABLE ROW LEVEL SECURITY;
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
-- Encrypted fields policies (one per field per user)
-- Upsert logic uses INSERT + UPDATE; DELETE for field removal
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
