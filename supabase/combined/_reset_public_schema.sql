-- =============================================================================
-- Reset-safe: drop our public-schema objects, then re-apply everything.
-- Skips anything owned by a Postgres extension (pg_trgm, pgcrypto, etc).
--
-- Safe because:
--   - It only touches the public schema
--   - auth.users rows are preserved (your magic-link session stays valid)
--   - storage buckets + uploads are preserved
-- =============================================================================

-- Step 1 — drop our custom trigger off auth.users (owns a dependency)
drop trigger if exists on_auth_user_created on auth.users;

-- Step 2 — drop objects in public created by our migrations, skipping
-- anything owned by an extension (pg_trgm etc).
do $$
declare
  r record;
begin
  -- Views first
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on c.relnamespace = n.oid
    left join pg_depend d on d.objid = c.oid and d.deptype = 'e'
    where n.nspname = 'public' and c.relkind = 'v' and d.objid is null
  loop
    execute format('drop view if exists public.%I cascade', r.relname);
  end loop;

  -- Tables (not owned by extensions)
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on c.relnamespace = n.oid
    left join pg_depend d on d.objid = c.oid and d.deptype = 'e'
    where n.nspname = 'public' and c.relkind = 'r' and d.objid is null
  loop
    execute format('drop table if exists public.%I cascade', r.relname);
  end loop;

  -- Enum types (never owned by extensions in practice, but filter anyway)
  for r in
    select t.typname
    from pg_type t
    join pg_namespace n on t.typnamespace = n.oid
    left join pg_depend d on d.objid = t.oid and d.deptype = 'e'
    where n.nspname = 'public' and t.typtype = 'e' and d.objid is null
  loop
    execute format('drop type if exists public.%I cascade', r.typname);
  end loop;

  -- User-defined functions (not owned by pg_trgm / pgcrypto / etc)
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
    where n.nspname = 'public' and d.objid is null
  loop
    execute format('drop function if exists public.%I(%s) cascade', r.proname, r.args);
  end loop;
end $$;

-- Step 3 — drop our storage bucket policies (buckets themselves are left
-- in place; phase 0's insert uses `on conflict (id) do nothing` so it's safe)
drop policy if exists "doc_read_owned"     on storage.objects;
drop policy if exists "doc_upload_owned"   on storage.objects;
drop policy if exists "report_read_member" on storage.objects;
