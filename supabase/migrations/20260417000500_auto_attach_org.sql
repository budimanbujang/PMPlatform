-- =============================================================================
-- QoL: auto-attach users to their organisation by email domain on first login.
-- Removes the need to manually UPDATE profiles.organisation_id in SQL editor.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_domain text := split_part(new.email, '@', 2);
begin
  -- Try to match the user's email domain to an organisation.
  select id into v_org_id
  from public.organisations
  where lower(domain) = lower(v_domain)
  limit 1;

  -- Fallback: if there's only one org on the platform, use it.
  if v_org_id is null and (select count(*) from public.organisations) = 1 then
    select id into v_org_id from public.organisations limit 1;
  end if;

  insert into public.profiles (id, organisation_id, email, full_name, avatar_url)
  values (
    new.id,
    v_org_id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
    set organisation_id = coalesce(public.profiles.organisation_id, excluded.organisation_id),
        full_name       = coalesce(public.profiles.full_name, excluded.full_name),
        avatar_url      = coalesce(public.profiles.avatar_url, excluded.avatar_url);

  return new;
end;
$$;

-- Back-fill: attach any existing profile rows that are missing org_id
-- but whose email domain matches an organisation.
update public.profiles p
set organisation_id = o.id
from public.organisations o
where p.organisation_id is null
  and lower(split_part(p.email, '@', 2)) = lower(o.domain);
