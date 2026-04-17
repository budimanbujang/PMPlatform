-- =============================================================================
-- Reset-safe: drop our public-schema objects, then re-apply everything.
-- Paste this BEFORE the main all_in_one.sql, or use all_in_one_reset.sql
-- (which has this prepended).
--
-- Safe because:
--   - It only touches the public schema
--   - auth.users rows are preserved (your magic-link session stays valid)
--   - storage buckets + uploads are preserved
-- =============================================================================

-- Step 1 — drop our custom trigger off auth.users (owns a dependency)
drop trigger if exists on_auth_user_created on auth.users;

-- Step 2 — drop all tables, views, types, functions in public created by our migrations
do $$
declare
  r record;
begin
  -- Views first (nothing depends on them)
  for r in select viewname from pg_views where schemaname = 'public' loop
    execute format('drop view if exists public.%I cascade', r.viewname);
  end loop;

  -- Tables with cascade
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('drop table if exists public.%I cascade', r.tablename);
  end loop;

  -- Enum types we created (e.g. project_status, project_rag, etc.)
  for r in
    select t.typname
    from pg_type t
    join pg_namespace n on t.typnamespace = n.oid
    where n.nspname = 'public' and t.typtype = 'e'
  loop
    execute format('drop type if exists public.%I cascade', r.typname);
  end loop;

  -- Any remaining functions in public (helper + trigger functions)
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname = 'public'
  loop
    execute format('drop function if exists public.%I(%s) cascade', r.proname, r.args);
  end loop;
end $$;

-- Step 3 — drop our storage bucket policies (created in phase 0)
drop policy if exists "doc_read_owned"   on storage.objects;
drop policy if exists "doc_upload_owned" on storage.objects;
drop policy if exists "report_read_member" on storage.objects;

-- Step 4 — remove storage buckets so phase 0 re-seeds them cleanly
delete from storage.buckets where id in ('project-documents', 'reports');
