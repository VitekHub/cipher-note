-- ============================================
-- Cipher Note: Key Rotation RPC Function
-- ============================================
-- A single SECURITY DEFINER RPC that performs an atomic field-key rotation:
--
--   1. Insert the new wrapped field key version (v_new).
--   2. Replace every entry's ciphertext for that field with re-encrypted content.
--   3. Delete all older wrapped-key versions for that field.
--
-- All three steps run in one transaction, so the server is either all-v_old or
-- all-v_new — never mixed. A failure at any step rolls the whole thing back,
-- leaving the vault in its pre-rotation state. The client never needs
-- version-fallback logic.
--
-- Caller identity comes from auth.uid() inside the function (SECURITY DEFINER
-- bypasses RLS), so no user_id is passed — there is no impersonation surface.
-- The public.field_name enum cast rejects invalid field names at the type
-- boundary. NOT FOUND on an UPDATE raises → whole tx rolls back → no mixed state.
--
-- The realtime publication already includes field_keys and encrypted_fields
-- (00002_rls_policies.sql:167-169), so INSERT/UPDATE/DELETE emit postgres_changes
-- events. The DELETE on field_keys is intentionally ignored by the receiver
-- (supabase-realtime.ts).

CREATE OR REPLACE FUNCTION public.rotate_field_key(p_payload JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      UUID    := auth.uid();
  v_field_name   public.field_name;
  v_new_version  INTEGER;
  v_wrapped_key  TEXT;
  v_key_iv       TEXT;
  v_fields       JSONB;
  v_row          JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_field_name  := (p_payload->>'field_name')::public.field_name;
  v_new_version := (p_payload->>'new_version')::INTEGER;
  v_wrapped_key := p_payload->>'new_wrapped_field_key';
  v_key_iv      := p_payload->>'new_field_key_iv';
  v_fields      := COALESCE(p_payload->'re_encrypted_fields', '[]'::jsonb);

  IF v_new_version < 1 THEN
    RAISE EXCEPTION 'Invalid version';
  END IF;

  -- 1. Insert the new wrapped field key (v_new). The UNIQUE(user_id, field_name, version)
  --    constraint lets v_new coexist with v_old until step 3.
  INSERT INTO public.field_keys (user_id, field_name, version, wrapped_field_key, field_key_iv)
  VALUES (v_user_id, v_field_name, v_new_version, v_wrapped_key, v_key_iv);

  -- 2. Replace every entry's ciphertext for this field with the re-encrypted content.
  --    user_id filter is defensive (SECURITY DEFINER bypasses RLS); the row must exist.
  FOR v_row IN SELECT * FROM jsonb_array_elements(v_fields) LOOP
    UPDATE public.encrypted_fields
      SET ciphertext    = v_row->>'ciphertext',
          ciphertext_iv = v_row->>'ciphertext_iv',
          updated_at    = now()
      WHERE entry_id   = (v_row->>'entry_id')::uuid
        AND field_name = v_field_name
        AND user_id    = v_user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Encrypted field not found for entry %', v_row->>'entry_id';
    END IF;
  END LOOP;

  -- 3. Delete all older wrapped-key versions for this field.
  DELETE FROM public.field_keys
    WHERE user_id = v_user_id AND field_name = v_field_name AND version < v_new_version;
END;
$$;

-- Revoke default PUBLIC/anon grants — rotate_field_key is authenticated-only.
REVOKE ALL ON FUNCTION public.rotate_field_key(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rotate_field_key(JSONB) FROM anon;

GRANT EXECUTE ON FUNCTION public.rotate_field_key(JSONB) TO authenticated;
