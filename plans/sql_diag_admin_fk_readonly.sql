-- Read-only 診斷：admin 升權時 user_role_bindings FK 失敗
-- 用法：只改 v_target_email，整份在 Supabase SQL Editor 執行

DO $$
DECLARE
  v_target_email text := 'your_email@example.com'; -- TODO: 改成目標帳號
  v_user_id uuid;

  v_has_profiles boolean;
  v_has_profile_id boolean;
  v_has_profile_user_id boolean;

  v_has_bindings boolean;
  v_has_bindings_user_id boolean;

  v_profile_row jsonb;
  v_binding_rows jsonb;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(v_target_email)
  ORDER BY created_at DESC
  LIMIT 1;

  RAISE NOTICE '[diag] target_email=%', v_target_email;
  RAISE NOTICE '[diag] auth_user_id=%', coalesce(v_user_id::text, '<null>');

  v_has_profiles := to_regclass('public.user_profiles') IS NOT NULL;
  v_has_bindings := to_regclass('public.user_role_bindings') IS NOT NULL;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'id'
  ) INTO v_has_profile_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'user_id'
  ) INTO v_has_profile_user_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_role_bindings' AND column_name = 'user_id'
  ) INTO v_has_bindings_user_id;

  IF v_user_id IS NOT NULL AND v_has_profiles THEN
    IF v_has_profile_user_id THEN
      EXECUTE 'SELECT to_jsonb(up) FROM public.user_profiles up WHERE up.user_id = $1 LIMIT 1'
      INTO v_profile_row
      USING v_user_id;
      RAISE NOTICE '[diag] profile_lookup_key=user_id';
    ELSIF v_has_profile_id THEN
      EXECUTE 'SELECT to_jsonb(up) FROM public.user_profiles up WHERE up.id = $1 LIMIT 1'
      INTO v_profile_row
      USING v_user_id;
      RAISE NOTICE '[diag] profile_lookup_key=id';
    ELSE
      RAISE NOTICE '[diag] user_profiles exists but no id/user_id column found';
    END IF;
  ELSE
    RAISE NOTICE '[diag] profile check skipped (no auth user or no user_profiles table)';
  END IF;

  IF v_user_id IS NOT NULL AND v_has_bindings AND v_has_bindings_user_id THEN
    EXECUTE '
      SELECT coalesce(jsonb_agg(to_jsonb(urb) ORDER BY urb.created_at), ''[]''::jsonb)
      FROM public.user_role_bindings urb
      WHERE urb.user_id = $1
    '
    INTO v_binding_rows
    USING v_user_id;
  ELSE
    v_binding_rows := '[]'::jsonb;
  END IF;

  RAISE NOTICE '[diag] profile_row=%', coalesce(v_profile_row::text, '<null>');
  RAISE NOTICE '[diag] role_binding_rows=%', coalesce(v_binding_rows::text, '[]');
END
$$;

-- FK 實際指向欄位（最關鍵）
SELECT
  con.conname AS fk_name,
  conrel.relname AS child_table,
  a_child.attname AS child_column,
  confrel.relname AS parent_table,
  a_parent.attname AS parent_column
FROM pg_constraint con
JOIN pg_class conrel ON conrel.oid = con.conrelid
JOIN pg_class confrel ON confrel.oid = con.confrelid
JOIN LATERAL unnest(con.conkey) WITH ORDINALITY ck(attnum, ord) ON true
JOIN LATERAL unnest(con.confkey) WITH ORDINALITY fk(attnum, ord) ON fk.ord = ck.ord
JOIN pg_attribute a_child ON a_child.attrelid = con.conrelid AND a_child.attnum = ck.attnum
JOIN pg_attribute a_parent ON a_parent.attrelid = con.confrelid AND a_parent.attnum = fk.attnum
WHERE con.contype = 'f'
  AND conrel.relname = 'user_role_bindings'
  AND con.connamespace = 'public'::regnamespace;

-- auth.users 上與 profile 建立相關 trigger
SELECT
  tg.tgname,
  p.proname AS function_name,
  c.relname AS table_name,
  tg.tgenabled
FROM pg_trigger tg
JOIN pg_class c ON c.oid = tg.tgrelid
JOIN pg_proc p ON p.oid = tg.tgfoid
WHERE c.relname = 'users'
  AND c.relnamespace = 'auth'::regnamespace
  AND NOT tg.tgisinternal
ORDER BY tg.tgname;

