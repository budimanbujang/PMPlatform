-- =============================================================================
-- Phase 4 — Enterprise Integration & Audit
-- =============================================================================

create table public.integrations (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  kind            text not null check (kind in ('hr','finance_erp','jira','asana','ms_project','teams','sharepoint','gdrive')),
  name            text not null,
  config          jsonb not null default '{}'::jsonb,
  secret_ref      text,     -- pointer into secret manager, never the secret itself
  is_active       boolean not null default false,
  last_synced_at  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_int_updated before update on public.integrations
  for each row execute function public.tg_set_updated_at();

create table public.integration_mappings (
  id              uuid primary key default gen_random_uuid(),
  integration_id  uuid not null references public.integrations(id) on delete cascade,
  local_entity    text not null,
  local_id        uuid not null,
  remote_entity   text not null,
  remote_id       text not null,
  last_synced_at  timestamptz,
  unique (integration_id, local_entity, local_id, remote_entity)
);

create table public.audit_log (
  id              bigserial primary key,
  organisation_id uuid,
  actor_id        uuid,
  actor_email     text,
  action          text not null,
  entity_type     text not null,
  entity_id       uuid,
  diff            jsonb,
  ip_address      inet,
  user_agent      text,
  at              timestamptz not null default now()
);
create index idx_audit_entity on public.audit_log(entity_type, entity_id, at desc);
create index idx_audit_actor on public.audit_log(actor_id, at desc);

create table public.permission_overrides (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  scope           text not null,
  scope_id        uuid,
  capability      text not null,
  granted         boolean not null default true,
  expires_at      timestamptz,
  created_at      timestamptz not null default now()
);

create table public.data_retention_policies (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  entity_type     text not null,
  retain_days     integer not null,
  last_enforced_at timestamptz,
  unique (organisation_id, entity_type)
);

alter table public.integrations              enable row level security;
alter table public.integration_mappings      enable row level security;
alter table public.audit_log                 enable row level security;
alter table public.permission_overrides      enable row level security;
alter table public.data_retention_policies   enable row level security;

create policy int_admin on public.integrations for all using (public.is_platform_admin())
  with check (public.is_platform_admin());
create policy intmap_admin on public.integration_mappings for all using (public.is_platform_admin())
  with check (public.is_platform_admin());
create policy audit_read on public.audit_log for select using (
  public.is_platform_admin()
  or (organisation_id = public.current_org_id()
      and actor_id = auth.uid())
);
create policy po_read on public.permission_overrides for select using (
  profile_id = auth.uid() or public.is_platform_admin()
);
create policy po_write on public.permission_overrides for all using (public.is_platform_admin())
  with check (public.is_platform_admin());
create policy drp_admin on public.data_retention_policies for all using (public.is_platform_admin())
  with check (public.is_platform_admin());
