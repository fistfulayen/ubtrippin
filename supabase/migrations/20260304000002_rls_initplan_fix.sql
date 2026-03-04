-- PRD-033 P2A: Wrap auth functions in initplan subselects for RLS performance.

-- Update helper functions to avoid per-row auth.uid() evaluation.
CREATE OR REPLACE FUNCTION public.is_trip_owner(p_trip_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trips
    WHERE id = p_trip_id
      AND user_id = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_family_member(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.family_members fm1
    JOIN public.family_members fm2 ON fm1.family_id = fm2.family_id
    WHERE fm1.user_id = (SELECT auth.uid())
      AND fm2.user_id = target_user_id
      AND fm1.accepted_at IS NOT NULL
      AND fm2.accepted_at IS NOT NULL
      AND fm1.user_id <> fm2.user_id
  );
$$;

-- is_family_member_of: checks if the current user shares a family with target_user_id.
-- Previously this function also accepted a family_id (target_family_id), but all
-- family_id usage has been inlined into the consolidated policies (P2B).
-- DROP + recreate required because PostgreSQL forbids renaming parameters via CREATE OR REPLACE.
DROP FUNCTION IF EXISTS public.is_family_member_of(uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.is_family_member_of(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.family_members fm1
    JOIN public.family_members fm2 ON fm1.family_id = fm2.family_id
    WHERE fm1.user_id = (SELECT auth.uid())
      AND fm2.user_id = target_user_id
      AND fm1.accepted_at IS NOT NULL
      AND fm2.accepted_at IS NOT NULL
      AND fm1.user_id <> fm2.user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_family_admin(target_family_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.family_members
    WHERE family_id = target_family_id
      AND user_id = (SELECT auth.uid())
      AND role = 'admin'
      AND accepted_at IS NOT NULL
  );
$$;

DO $$
DECLARE
  pol RECORD;
  cmd_sql text;
  mode_sql text;
  role_name text;
  role_list text;
  role_clause text;
  using_expr_original text;
  check_expr_original text;
  using_expr_rewritten text;
  check_expr_rewritten text;
  create_sql text;
BEGIN
  FOR pol IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      pg_pol.polname,
      pg_pol.polcmd,
      pg_pol.polpermissive,
      pg_pol.polroles,
      pg_get_expr(pg_pol.polqual, pg_pol.polrelid) AS using_expr,
      pg_get_expr(pg_pol.polwithcheck, pg_pol.polrelid) AS check_expr
    FROM pg_policy pg_pol
    JOIN pg_class c ON c.oid = pg_pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
    ORDER BY c.relname, pg_pol.polname
  LOOP
    using_expr_original := pol.using_expr;
    check_expr_original := pol.check_expr;

    using_expr_rewritten := using_expr_original;
    check_expr_rewritten := check_expr_original;

    IF using_expr_rewritten IS NOT NULL THEN
      using_expr_rewritten := replace(using_expr_rewritten, '(SELECT auth.uid())', '__PRD033_AUTH_UID__');
      using_expr_rewritten := replace(using_expr_rewritten, '(select auth.uid())', '__PRD033_AUTH_UID__');
      using_expr_rewritten := replace(using_expr_rewritten, '(SELECT auth.jwt())', '__PRD033_AUTH_JWT__');
      using_expr_rewritten := replace(using_expr_rewritten, '(select auth.jwt())', '__PRD033_AUTH_JWT__');
      using_expr_rewritten := replace(using_expr_rewritten, 'auth.uid()', '(SELECT auth.uid())');
      using_expr_rewritten := replace(using_expr_rewritten, 'auth.jwt()', '(SELECT auth.jwt())');
      using_expr_rewritten := replace(using_expr_rewritten, '__PRD033_AUTH_UID__', '(SELECT auth.uid())');
      using_expr_rewritten := replace(using_expr_rewritten, '__PRD033_AUTH_JWT__', '(SELECT auth.jwt())');
    END IF;

    IF check_expr_rewritten IS NOT NULL THEN
      check_expr_rewritten := replace(check_expr_rewritten, '(SELECT auth.uid())', '__PRD033_AUTH_UID__');
      check_expr_rewritten := replace(check_expr_rewritten, '(select auth.uid())', '__PRD033_AUTH_UID__');
      check_expr_rewritten := replace(check_expr_rewritten, '(SELECT auth.jwt())', '__PRD033_AUTH_JWT__');
      check_expr_rewritten := replace(check_expr_rewritten, '(select auth.jwt())', '__PRD033_AUTH_JWT__');
      check_expr_rewritten := replace(check_expr_rewritten, 'auth.uid()', '(SELECT auth.uid())');
      check_expr_rewritten := replace(check_expr_rewritten, 'auth.jwt()', '(SELECT auth.jwt())');
      check_expr_rewritten := replace(check_expr_rewritten, '__PRD033_AUTH_UID__', '(SELECT auth.uid())');
      check_expr_rewritten := replace(check_expr_rewritten, '__PRD033_AUTH_JWT__', '(SELECT auth.jwt())');
    END IF;

    IF coalesce(using_expr_original, '') = coalesce(using_expr_rewritten, '')
       AND coalesce(check_expr_original, '') = coalesce(check_expr_rewritten, '') THEN
      CONTINUE;
    END IF;

    cmd_sql := CASE pol.polcmd
      WHEN 'r' THEN 'SELECT'
      WHEN 'a' THEN 'INSERT'
      WHEN 'w' THEN 'UPDATE'
      WHEN 'd' THEN 'DELETE'
      ELSE 'ALL'
    END;

    mode_sql := CASE WHEN pol.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END;

    role_list := NULL;
    IF pol.polroles IS NOT NULL AND array_length(pol.polroles, 1) IS NOT NULL THEN
      IF 0 = ANY(pol.polroles) THEN
        role_list := 'PUBLIC';
      END IF;

      FOR role_name IN
        SELECT quote_ident(r.rolname)
        FROM pg_roles r
        WHERE r.oid = ANY(pol.polroles)
          AND r.oid <> 0
        ORDER BY r.rolname
      LOOP
        role_list := CASE
          WHEN role_list IS NULL THEN role_name
          ELSE role_list || ', ' || role_name
        END;
      END LOOP;
    END IF;

    role_clause := CASE
      WHEN role_list IS NULL THEN ''
      ELSE ' TO ' || role_list
    END;

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.polname, pol.schema_name, pol.table_name);

    create_sql := format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s%s',
      pol.polname,
      pol.schema_name,
      pol.table_name,
      mode_sql,
      cmd_sql,
      role_clause
    );

    IF using_expr_rewritten IS NOT NULL THEN
      create_sql := create_sql || format(' USING (%s)', using_expr_rewritten);
    END IF;

    IF check_expr_rewritten IS NOT NULL THEN
      create_sql := create_sql || format(' WITH CHECK (%s)', check_expr_rewritten);
    END IF;

    EXECUTE create_sql;
  END LOOP;
END $$;

DROP POLICY IF EXISTS "profiles_family_read" ON public.profiles;
CREATE POLICY "profiles_family_read" ON public.profiles
  FOR SELECT
  USING (
    (SELECT auth.uid()) = id
    OR public.is_family_member_of(id)
  );

DROP POLICY IF EXISTS "user_profiles_family_read" ON public.user_profiles;
CREATE POLICY "user_profiles_family_read" ON public.user_profiles
  FOR SELECT
  USING (
    (SELECT auth.uid()) = id
    OR public.is_family_member(id)
  );
