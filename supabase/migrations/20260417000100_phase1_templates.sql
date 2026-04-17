-- =============================================================================
-- Phase 1 — Platform Generalisation
-- Templates, form builder fields, cadence schedules, lifecycle events
-- =============================================================================

create table public.project_templates (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  kind            text not null check (kind in ('transformation','it_build','infrastructure','strategic','bau')),
  name            text not null,
  description     text,
  default_cadence text not null default 'weekly',
  default_rag_rules jsonb not null default '{}'::jsonb,
  form_template_id uuid references public.submission_templates(id),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_ptpl_updated before update on public.project_templates
  for each row execute function public.tg_set_updated_at();

-- Normalised form fields (alternative to jsonb modules on submission_templates)
create type form_field_type as enum (
  'rag','number','currency','short_text','long_text',
  'date','file','toggle','dropdown','multi_select','user_picker'
);

create table public.form_fields (
  id              uuid primary key default gen_random_uuid(),
  template_id     uuid not null references public.submission_templates(id) on delete cascade,
  module_key      text not null,
  field_key       text not null,
  label           text not null,
  help_text       text,
  field_type      form_field_type not null,
  required        boolean not null default false,
  visible_roles   member_role[],
  options         jsonb,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  unique (template_id, field_key)
);
create index idx_form_fields_tpl on public.form_fields(template_id, sort_order);

-- Cadence overrides per project role
create table public.cadence_schedules (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  role            member_role not null,
  deadline_dow    smallint not null,
  deadline_time   time not null,
  reminder_lead_hours integer not null default 24,
  unique (project_id, role)
);

-- Lifecycle events
create table public.project_lifecycle_events (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  from_status     project_status,
  to_status       project_status not null,
  reason          text,
  actor_id        uuid references public.profiles(id),
  created_at      timestamptz not null default now()
);
create index idx_lifecycle_project on public.project_lifecycle_events(project_id, created_at desc);

alter table public.project_templates        enable row level security;
alter table public.form_fields              enable row level security;
alter table public.cadence_schedules        enable row level security;
alter table public.project_lifecycle_events enable row level security;

create policy ptpl_read on public.project_templates for select using (
  organisation_id = public.current_org_id() or public.is_platform_admin()
);
create policy ptpl_write on public.project_templates for all using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy ff_read on public.form_fields for select using (
  exists (select 1 from public.submission_templates t
    where t.id = template_id
      and (t.organisation_id = public.current_org_id() or public.is_platform_admin()))
);
create policy ff_write on public.form_fields for all using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy cadence_read on public.cadence_schedules for select using (
  public.is_project_member(project_id) or public.is_platform_admin()
);
create policy cadence_write on public.cadence_schedules for all using (
  public.has_project_role(project_id, array['pmo','tmo','sponsor']::member_role[])
  or public.is_platform_admin()
) with check (true);

create policy lifecycle_read on public.project_lifecycle_events for select using (
  public.is_project_member(project_id) or public.is_platform_admin()
);
create policy lifecycle_insert on public.project_lifecycle_events for insert with check (
  public.has_project_role(project_id, array['pmo','tmo','sponsor']::member_role[])
  or public.is_platform_admin()
);
