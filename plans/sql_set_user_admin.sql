-- 將指定帳號提升為 admin（支援 v2 / v3 schema，自動判斷，可重跑）
-- 使用方式：只需修改下方 v_target_email

DO $$
DECLARE
  v_target_email text := 'your_email@example.com'; -- TODO: 改成要升級的帳號
  v_user_id uuid;
  v_auth_email text;
  v_auth_meta jsonb;
  v_full_name text;
  v_display_name text;

  v_has_user_profiles boolean;
  v_has_user_profiles_id boolean;
  v_has_user_profiles_user_id boolean;
  v_has_user_profiles_email boolean;
  v_has_user_profiles_full_name boolean;
  v_has_user_profiles_display_name boolean;
  v_has_user_profiles_preferred_locale boolean;
  v_has_user_profiles_is_active boolean;
  v_has_user_profiles_role boolean;
  v_has_user_profiles_status boolean;
  v_has_user_profiles_trial_expires_at boolean;
  v_has_user_profiles_created_at boolean;
  v_has_user_profiles_updated_at boolean;

  v_has_user_role_bindings boolean;
  v_has_user_role_bindings_user_id boolean;
  v_has_user_role_bindings_role boolean;
  v_has_user_role_bindings_store_id boolean;
  v_has_user_role_bindings_updated_at boolean;

  v_profile_key_col text;
  v_profile_exists boolean;
  v_insert_cols text;
  v_insert_vals text;
  v_sql text;
BEGIN
  -- 0) 找 auth.users 對應 user
  SELECT u.id, u.email, coalesce(u.raw_user_meta_data, '{}'::jsonb)
  INTO v_user_id, v_auth_email, v_auth_meta
  FROM auth.users u
  WHERE lower(u.email) = lower(v_target_email)
  ORDER BY u.created_at DESC
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '找不到 auth.users 帳號: %', v_target_email;
  END IF;

  v_full_name := coalesce(
    nullif(v_auth_meta->>'full_name', ''),
    nullif(v_auth_meta->>'name', ''),
    split_part(coalesce(v_auth_email, v_target_email), '@', 1),
    coalesce(v_auth_email, v_target_email)
  );
  v_display_name := coalesce(
    nullif(v_auth_meta->>'display_name', ''),
    nullif(v_auth_meta->>'full_name', ''),
    nullif(v_auth_meta->>'name', ''),
    split_part(coalesce(v_auth_email, v_target_email), '@', 1)
  );

  -- 1) 檢查 schema（v2 / v3）
  v_has_user_profiles := to_regclass('public.user_profiles') IS NOT NULL;
  v_has_user_role_bindings := to_regclass('public.user_role_bindings') IS NOT NULL;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'id'
  ) INTO v_has_user_profiles_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'user_id'
  ) INTO v_has_user_profiles_user_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'email'
  ) INTO v_has_user_profiles_email;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'full_name'
  ) INTO v_has_user_profiles_full_name;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'display_name'
  ) INTO v_has_user_profiles_display_name;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'preferred_locale'
  ) INTO v_has_user_profiles_preferred_locale;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'is_active'
  ) INTO v_has_user_profiles_is_active;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'role'
  ) INTO v_has_user_profiles_role;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'status'
  ) INTO v_has_user_profiles_status;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'trial_expires_at'
  ) INTO v_has_user_profiles_trial_expires_at;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'created_at'
  ) INTO v_has_user_profiles_created_at;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'updated_at'
  ) INTO v_has_user_profiles_updated_at;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_role_bindings' AND column_name = 'user_id'
  ) INTO v_has_user_role_bindings_user_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_role_bindings' AND column_name = 'role'
  ) INTO v_has_user_role_bindings_role;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_role_bindings' AND column_name = 'store_id'
  ) INTO v_has_user_role_bindings_store_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_role_bindings' AND column_name = 'updated_at'
  ) INTO v_has_user_role_bindings_updated_at;

  -- 2) 更新 public.user_profiles（如果存在）
  IF v_has_user_profiles THEN
    IF v_has_user_profiles_user_id THEN
      v_profile_key_col := 'user_id';
    ELSIF v_has_user_profiles_id THEN
      v_profile_key_col := 'id';
    ELSE
      v_profile_key_col := NULL;
    END IF;

    IF v_profile_key_col IS NOT NULL THEN
      EXECUTE format(
        'SELECT EXISTS (SELECT 1 FROM public.user_profiles WHERE %I = $1)',
        v_profile_key_col
      )
      INTO v_profile_exists
      USING v_user_id;

      -- 2.1) 若缺 profile，先補 profile（關鍵：先滿足 user_role_bindings 的 FK）
      IF NOT v_profile_exists THEN
        v_insert_cols := format('%I', v_profile_key_col);
        v_insert_vals := quote_literal(v_user_id::text) || '::uuid';

        IF v_has_user_profiles_email THEN
          v_insert_cols := v_insert_cols || ', email';
          v_insert_vals := v_insert_vals || ', ' || quote_literal(coalesce(v_auth_email, v_target_email));
        END IF;

        IF v_has_user_profiles_full_name THEN
          v_insert_cols := v_insert_cols || ', full_name';
          v_insert_vals := v_insert_vals || ', ' || quote_literal(v_full_name);
        END IF;

        IF v_has_user_profiles_display_name THEN
          v_insert_cols := v_insert_cols || ', display_name';
          v_insert_vals := v_insert_vals || ', ' || quote_literal(v_display_name);
        END IF;

        IF v_has_user_profiles_preferred_locale THEN
          v_insert_cols := v_insert_cols || ', preferred_locale';
          v_insert_vals := v_insert_vals || ', ''en''';
        END IF;

        IF v_has_user_profiles_is_active THEN
          v_insert_cols := v_insert_cols || ', is_active';
          v_insert_vals := v_insert_vals || ', true';
        END IF;

        IF v_has_user_profiles_role THEN
          v_insert_cols := v_insert_cols || ', role';
          v_insert_vals := v_insert_vals || ', ''admin''';
        END IF;

        IF v_has_user_profiles_status THEN
          v_insert_cols := v_insert_cols || ', status';
          v_insert_vals := v_insert_vals || ', ''active''';
        END IF;

        IF v_has_user_profiles_trial_expires_at THEN
          v_insert_cols := v_insert_cols || ', trial_expires_at';
          v_insert_vals := v_insert_vals || ', NULL';
        END IF;

        IF v_has_user_profiles_created_at THEN
          v_insert_cols := v_insert_cols || ', created_at';
          v_insert_vals := v_insert_vals || ', now()';
        END IF;

        IF v_has_user_profiles_updated_at THEN
          v_insert_cols := v_insert_cols || ', updated_at';
          v_insert_vals := v_insert_vals || ', now()';
        END IF;

        EXECUTE format(
          'INSERT INTO public.user_profiles (%s) VALUES (%s) ON CONFLICT DO NOTHING',
          v_insert_cols,
          v_insert_vals
        );
      END IF;

      -- 2.2) profile 存在後再做升權欄位更新
      v_sql := 'UPDATE public.user_profiles SET ';

      IF v_has_user_profiles_role THEN
        v_sql := v_sql || 'role = ''admin'', ';
      END IF;

      IF v_has_user_profiles_status THEN
        v_sql := v_sql || 'status = ''active'', ';
      END IF;

      IF v_has_user_profiles_trial_expires_at THEN
        v_sql := v_sql || 'trial_expires_at = NULL, ';
      END IF;

      IF v_has_user_profiles_updated_at THEN
        v_sql := v_sql || 'updated_at = now(), ';
      END IF;

      -- 去掉最後多餘的 ", "
      v_sql := regexp_replace(v_sql, ',\s*$', '');
      v_sql := v_sql || format(' WHERE %I = $1', v_profile_key_col);

      -- 若有可更新欄位才執行
      IF v_sql NOT LIKE 'UPDATE public.user_profiles SET WHERE%' THEN
        EXECUTE v_sql USING v_user_id;
      END IF;

      -- 補 email（僅在該欄位存在且目前為 NULL）
      IF v_has_user_profiles_email THEN
        EXECUTE format(
          'UPDATE public.user_profiles SET email = $1 WHERE %I = $2 AND email IS NULL',
          v_profile_key_col
        )
        USING v_target_email, v_user_id;
      END IF;
    ELSE
      RAISE NOTICE '偵測到 public.user_profiles，但找不到 id/user_id 主鍵欄位，略過 profile 更新。';
    END IF;
  ELSE
    RAISE NOTICE '未偵測到 public.user_profiles，略過 profile 更新。';
  END IF;

  -- 3) v3 角色表：upsert admin 綁定（store_id = NULL，全域 admin）
  IF v_has_user_role_bindings
     AND v_has_user_role_bindings_user_id
     AND v_has_user_role_bindings_role THEN

    -- 先嘗試更新既有 NULL store scope 的 admin 綁定，確保可重跑
    IF v_has_user_role_bindings_store_id THEN
      IF v_has_user_role_bindings_updated_at THEN
        EXECUTE '
          UPDATE public.user_role_bindings
          SET updated_at = now()
          WHERE user_id = $1
            AND role::text = ''admin''
            AND store_id IS NULL
        ' USING v_user_id;
      END IF;

      -- 若不存在則新增一筆（避免依賴特定 unique constraint 名稱）
      EXECUTE '
        INSERT INTO public.user_role_bindings (user_id, role, store_id)
        SELECT $1, ''admin''::public.app_role, NULL
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.user_role_bindings urb
          WHERE urb.user_id = $1
            AND urb.role::text = ''admin''
            AND urb.store_id IS NULL
        )
      ' USING v_user_id;
    ELSE
      -- 舊結構若無 store_id，退化為 user_id + role 唯一
      IF v_has_user_role_bindings_updated_at THEN
        EXECUTE '
          UPDATE public.user_role_bindings
          SET updated_at = now()
          WHERE user_id = $1
            AND role::text = ''admin''
        ' USING v_user_id;
      END IF;

      EXECUTE '
        INSERT INTO public.user_role_bindings (user_id, role)
        SELECT $1, ''admin''::public.app_role
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.user_role_bindings urb
          WHERE urb.user_id = $1
            AND urb.role::text = ''admin''
        )
      ' USING v_user_id;
    END IF;
  ELSE
    RAISE NOTICE '未偵測到可用的 public.user_role_bindings(role,user_id)，略過角色綁定。';
  END IF;

  -- 4) 同步 auth.users app_metadata（可重跑）
  UPDATE auth.users u
  SET raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'admin', 'status', 'active')
  WHERE u.id = v_user_id;

  RAISE NOTICE '完成：admin 設定完成，email=%, user_id=%', v_target_email, v_user_id;
END
$$;

-- 5) 驗證（schema-aware，不直接引用可能不存在的欄位/資料表）
DO $$
DECLARE
  v_target_email text := 'your_email@example.com'; -- 與上方相同
  v_user_id uuid;
  v_meta_role text;
  v_meta_status text;
  v_profile_json jsonb;
  v_role_bindings jsonb;
  v_profile_key_col text;
BEGIN
  SELECT id,
         raw_app_meta_data->>'role',
         raw_app_meta_data->>'status'
  INTO v_user_id, v_meta_role, v_meta_status
  FROM auth.users
  WHERE lower(email) = lower(v_target_email)
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE '[verify] auth.users 找不到 email=%', v_target_email;
    RETURN;
  END IF;

  IF to_regclass('public.user_profiles') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'user_id'
    ) THEN
      v_profile_key_col := 'user_id';
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'id'
    ) THEN
      v_profile_key_col := 'id';
    END IF;

    IF v_profile_key_col IS NOT NULL THEN
      EXECUTE format(
        'SELECT to_jsonb(up) FROM public.user_profiles up WHERE %I = $1 LIMIT 1',
        v_profile_key_col
      )
      INTO v_profile_json
      USING v_user_id;
    END IF;
  END IF;

  IF to_regclass('public.user_role_bindings') IS NOT NULL THEN
    EXECUTE '
      SELECT coalesce(jsonb_agg(to_jsonb(urb) ORDER BY urb.created_at), ''[]''::jsonb)
      FROM public.user_role_bindings urb
      WHERE urb.user_id = $1
    '
    INTO v_role_bindings
    USING v_user_id;
  END IF;

  RAISE NOTICE '[verify] auth_user_id=% email=% auth_meta_role=% auth_meta_status=%',
    v_user_id, v_target_email, coalesce(v_meta_role, '<null>'), coalesce(v_meta_status, '<null>');
  RAISE NOTICE '[verify] profile_json=%', coalesce(v_profile_json::text, '<null>');
  RAISE NOTICE '[verify] role_bindings=%', coalesce(v_role_bindings::text, '<null>');
END
$$;
