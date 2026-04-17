-- ==========================================================================
-- JCorp PMO Platform — combined migrations (Phase 0 → 4) + seed
-- Generated from supabase/migrations/* and supabase/seed/iris.sql
-- Safe to run once on a fresh Supabase project; idempotent where possible.
-- ==========================================================================

-- >>> BEGIN supabase/migrations/20260417000000_phase0_core.sql
-- =============================================================================
-- Phase 0 — Core Reporting Loop
-- =============================================================================
-- Tables: organisations, profiles, projects, initiatives, members,
--         submission_templates, submissions, documents, report_runs
-- Multi-tenant from day one via organisation_id + RLS.
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- -----------------------------------------------------------------------------
-- Helper: updated_at trigger
-- -----------------------------------------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- organisations
-- -----------------------------------------------------------------------------
create table public.organisations (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  brand_primary text default '#0284c7',
  brand_logo    text,
  domain        text,
  region        text default 'ap-southeast-1',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_orgs_updated before update on public.organisations
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- profiles (mirror of auth.users, keyed by auth uid)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  organisation_id uuid references public.organisations(id) on delete set null,
  email           text not null unique,
  full_name       text,
  avatar_url      text,
  job_title       text,
  department      text,
  is_platform_admin boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- Auto-create profile row on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- projects
-- -----------------------------------------------------------------------------
create type project_status as enum ('draft','active','on_hold','closed','archived');
create type project_rag    as enum ('green','amber','red','grey');

create table public.projects (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  code            text not null,
  name            text not null,
  description     text,
  department      text,
  sponsor_id      uuid references public.profiles(id),
  status          project_status not null default 'draft',
  rag             project_rag not null default 'grey',
  cadence         text not null default 'weekly' check (cadence in ('weekly','biweekly','monthly')),
  submission_deadline_dow smallint default 1,   -- 1=Mon..7=Sun
  submission_deadline_time time default '15:00',
  report_day_dow  smallint default 2,           -- Tuesday
  report_time     time default '14:00',
  template_id     uuid,
  start_date      date,
  target_end_date date,
  closed_at       timestamptz,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organisation_id, code)
);
create index idx_projects_org on public.projects(organisation_id);
create index idx_projects_status on public.projects(status);
create trigger trg_projects_updated before update on public.projects
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- initiatives (workstreams within a project)
-- -----------------------------------------------------------------------------
create table public.initiatives (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  code            text not null,
  name            text not null,
  description     text,
  champion_id     uuid references public.profiles(id),
  io_id           uuid references public.profiles(id),   -- Initiative Owner
  rag             project_rag not null default 'grey',
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (project_id, code)
);
create index idx_initiatives_project on public.initiatives(project_id);
create trigger trg_initiatives_updated before update on public.initiatives
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- members (profile ↔ project with role)
-- -----------------------------------------------------------------------------
create type member_role as enum (
  'sponsor','executive','pmo','tmo','iwc',
  'champion','io','delivery_lead','finance_controller','steering','viewer'
);

create table public.members (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  role            member_role not null,
  initiative_id   uuid references public.initiatives(id) on delete set null,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (project_id, profile_id, role, initiative_id)
);
create index idx_members_project on public.members(project_id);
create index idx_members_profile on public.members(profile_id);
create trigger trg_members_updated before update on public.members
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- submission_templates — Phase 1 makes these editable; Phase 0 uses default
-- -----------------------------------------------------------------------------
create table public.submission_templates (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name            text not null,
  description     text,
  modules         jsonb not null default '[]'::jsonb,
  is_default      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_templates_updated before update on public.submission_templates
  for each row execute function public.tg_set_updated_at();

alter table public.projects
  add constraint projects_template_fk
  foreign key (template_id) references public.submission_templates(id) on delete set null;

-- -----------------------------------------------------------------------------
-- submissions — one row per initiative per reporting period
-- -----------------------------------------------------------------------------
create type submission_status as enum ('draft','submitted','late','missed','void');

create table public.submissions (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  initiative_id   uuid references public.initiatives(id) on delete cascade,
  period_start    date not null,
  period_end      date not null,
  due_at          timestamptz not null,
  submitted_at    timestamptz,
  submitted_by    uuid references public.profiles(id),
  status          submission_status not null default 'draft',
  rag             project_rag not null default 'grey',
  progress_pct    smallint check (progress_pct between 0 and 100),
  headline        text,
  progress_notes  text,
  risks_text      text,
  issues_text     text,
  narrative       text,
  escalate        boolean not null default false,
  escalate_reason text,
  payload         jsonb not null default '{}'::jsonb,  -- flexible template fields
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (initiative_id, period_start)
);
create index idx_submissions_project_period on public.submissions(project_id, period_start);
create index idx_submissions_status on public.submissions(status);
create index idx_submissions_escalate on public.submissions(escalate) where escalate;
create trigger trg_submissions_updated before update on public.submissions
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- documents — uploads tied to a submission (or to project/initiative/deliverable)
-- -----------------------------------------------------------------------------
create type document_tag as enum ('evidence','deliverable','reference','other');

create table public.documents (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id      uuid references public.projects(id) on delete cascade,
  initiative_id   uuid references public.initiatives(id) on delete set null,
  submission_id   uuid references public.submissions(id) on delete cascade,
  deliverable_id  uuid,  -- FK added in Phase 2 migration
  storage_path    text not null,       -- path inside the 'project-documents' bucket
  file_name       text not null,
  mime_type       text,
  size_bytes      bigint,
  tag             document_tag not null default 'other',
  description     text,
  uploaded_by     uuid references public.profiles(id),
  created_at      timestamptz not null default now()
);
create index idx_documents_project on public.documents(project_id);
create index idx_documents_submission on public.documents(submission_id);

-- -----------------------------------------------------------------------------
-- report_runs — one row per generated report
-- -----------------------------------------------------------------------------
create type report_status as enum ('queued','generating','succeeded','failed');

create table public.report_runs (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  period_start    date not null,
  period_end      date not null,
  status          report_status not null default 'queued',
  narrative_md    text,
  pdf_path        text,
  input_payload   jsonb,
  error_message   text,
  ai_model        text,
  ai_input_tokens integer,
  ai_output_tokens integer,
  ai_latency_ms   integer,
  created_at      timestamptz not null default now(),
  completed_at    timestamptz,
  unique (project_id, period_start)
);
create index idx_report_runs_project on public.report_runs(project_id, period_start desc);

-- -----------------------------------------------------------------------------
-- Helper functions for RLS (SECURITY DEFINER to avoid recursion on members)
-- -----------------------------------------------------------------------------
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_platform_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select organisation_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_project_member(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.members
    where project_id = p_project and profile_id = auth.uid() and is_active
  );
$$;

create or replace function public.has_project_role(p_project uuid, p_roles member_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.members
    where project_id = p_project and profile_id = auth.uid()
      and role = any(p_roles) and is_active
  );
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.organisations        enable row level security;
alter table public.profiles             enable row level security;
alter table public.projects             enable row level security;
alter table public.initiatives          enable row level security;
alter table public.members              enable row level security;
alter table public.submission_templates enable row level security;
alter table public.submissions          enable row level security;
alter table public.documents            enable row level security;
alter table public.report_runs          enable row level security;

-- Organisations: users read their own org; platform admin reads all
create policy org_read on public.organisations for select using (
  id = public.current_org_id() or public.is_platform_admin()
);
create policy org_admin_write on public.organisations for all using (
  public.is_platform_admin()
) with check (public.is_platform_admin());

-- Profiles: self + same-org colleagues read; self writes; platform admin full
create policy profile_read on public.profiles for select using (
  id = auth.uid()
  or organisation_id = public.current_org_id()
  or public.is_platform_admin()
);
create policy profile_self_update on public.profiles for update using (id = auth.uid())
  with check (id = auth.uid());
create policy profile_admin_write on public.profiles for all using (
  public.is_platform_admin()
) with check (public.is_platform_admin());

-- Projects — any member of the organisation can see the register; write is
-- gated by role. (Portfolio visibility is a core requirement.)
create policy project_read on public.projects for select using (
  organisation_id = public.current_org_id()
  or public.is_platform_admin()
);
create policy project_write on public.projects for all using (
  public.is_platform_admin()
  or public.has_project_role(id, array['pmo','tmo','sponsor']::member_role[])
) with check (
  organisation_id = public.current_org_id()
);

-- Initiatives — org-wide read, role-gated write
create policy initiative_read on public.initiatives for select using (
  organisation_id = public.current_org_id()
  or public.is_platform_admin()
);
create policy initiative_write on public.initiatives for all using (
  public.is_platform_admin()
  or public.has_project_role(project_id, array['pmo','tmo','sponsor']::member_role[])
) with check (organisation_id = public.current_org_id());

-- Members
create policy member_read on public.members for select using (
  organisation_id = public.current_org_id()
  and (public.is_project_member(project_id) or public.is_platform_admin())
);
create policy member_write on public.members for all using (
  public.is_platform_admin()
  or public.has_project_role(project_id, array['pmo','tmo','sponsor']::member_role[])
) with check (organisation_id = public.current_org_id());

-- Templates (org-scoped, writable by admins / PMO)
create policy template_read on public.submission_templates for select using (
  organisation_id = public.current_org_id() or public.is_platform_admin()
);
create policy template_write on public.submission_templates for all using (
  public.is_platform_admin()
) with check (public.is_platform_admin());

-- Submissions
create policy submission_read on public.submissions for select using (
  organisation_id = public.current_org_id()
  and (public.is_project_member(project_id) or public.is_platform_admin())
);
create policy submission_insert on public.submissions for insert with check (
  organisation_id = public.current_org_id()
  and public.is_project_member(project_id)
);
create policy submission_update on public.submissions for update using (
  submitted_by = auth.uid()
  or public.has_project_role(project_id, array['pmo','tmo','io','champion']::member_role[])
  or public.is_platform_admin()
) with check (organisation_id = public.current_org_id());

-- Documents
create policy document_read on public.documents for select using (
  organisation_id = public.current_org_id()
  and (public.is_project_member(project_id) or public.is_platform_admin())
);
create policy document_write on public.documents for all using (
  organisation_id = public.current_org_id()
  and public.is_project_member(project_id)
) with check (organisation_id = public.current_org_id());

-- Report runs (read only for most users; service role writes)
create policy report_read on public.report_runs for select using (
  organisation_id = public.current_org_id()
  and (public.is_project_member(project_id) or public.is_platform_admin())
);

-- -----------------------------------------------------------------------------
-- Storage bucket for project documents
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-documents', 'project-documents', false, 10485760, null)
on conflict (id) do nothing;

create policy "doc_read_owned" on storage.objects for select
  using (
    bucket_id = 'project-documents'
    and exists(
      select 1 from public.documents d
      where d.storage_path = storage.objects.name
        and public.is_project_member(d.project_id)
    )
  );

create policy "doc_upload_owned" on storage.objects for insert
  with check (
    bucket_id = 'project-documents'
    and auth.role() = 'authenticated'
  );

-- Reports bucket (PDFs)
insert into storage.buckets (id, name, public, file_size_limit)
values ('reports', 'reports', false, 26214400)
on conflict (id) do nothing;

create policy "report_read_member" on storage.objects for select
  using (
    bucket_id = 'reports'
    and exists(
      select 1 from public.report_runs r
      where r.pdf_path = storage.objects.name
        and public.is_project_member(r.project_id)
    )
  );

-- <<< END supabase/migrations/20260417000000_phase0_core.sql

-- >>> BEGIN supabase/migrations/20260417000100_phase1_templates.sql
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

-- <<< END supabase/migrations/20260417000100_phase1_templates.sql

-- >>> BEGIN supabase/migrations/20260417000200_phase2_governance.sql
-- =============================================================================
-- Phase 2 — Portfolio, Budget, Deliverables, Risks
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Portfolios / Programmes
-- -----------------------------------------------------------------------------
create table public.portfolios (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  code            text not null,
  name            text not null,
  description     text,
  sponsor_id      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organisation_id, code)
);
create trigger trg_portfolios_updated before update on public.portfolios
  for each row execute function public.tg_set_updated_at();

create table public.programmes (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  portfolio_id    uuid references public.portfolios(id) on delete set null,
  code            text not null,
  name            text not null,
  description     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organisation_id, code)
);
create trigger trg_programmes_updated before update on public.programmes
  for each row execute function public.tg_set_updated_at();

alter table public.projects add column programme_id uuid references public.programmes(id) on delete set null;
alter table public.projects add column portfolio_id uuid references public.portfolios(id) on delete set null;

-- -----------------------------------------------------------------------------
-- Budget
-- -----------------------------------------------------------------------------
create type budget_category as enum (
  'capex','opex','vendor','licensing','people','contingency','other'
);

create table public.budget_lines (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  initiative_id   uuid references public.initiatives(id) on delete set null,
  year            integer not null,
  quarter         smallint check (quarter between 1 and 4),
  category        budget_category not null default 'other',
  description     text not null,
  currency        text not null default 'MYR',
  planned_amount  numeric(18,2) not null default 0,
  committed_amount numeric(18,2) not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_budget_project on public.budget_lines(project_id, year);
create trigger trg_budget_updated before update on public.budget_lines
  for each row execute function public.tg_set_updated_at();

create table public.budget_actuals (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  budget_line_id  uuid not null references public.budget_lines(id) on delete cascade,
  period_end      date not null,
  actual_amount   numeric(18,2) not null,
  source          text default 'manual',   -- manual | upload | erp_sync
  reference       text,
  recorded_by     uuid references public.profiles(id),
  created_at      timestamptz not null default now()
);
create index idx_actuals_line on public.budget_actuals(budget_line_id, period_end);

-- Burn rate & variance view
create or replace view public.v_project_budget_summary as
select
  p.id as project_id,
  p.organisation_id,
  sum(bl.planned_amount)   as planned_total,
  sum(bl.committed_amount) as committed_total,
  coalesce(sum(ba.actual_amount), 0) as actual_total,
  case when sum(bl.planned_amount) > 0
       then round( (coalesce(sum(ba.actual_amount),0) - sum(bl.planned_amount))
                   / sum(bl.planned_amount) * 100, 2)
       else 0 end as variance_pct
from public.projects p
left join public.budget_lines bl on bl.project_id = p.id
left join public.budget_actuals ba on ba.budget_line_id = bl.id
group by p.id, p.organisation_id;

-- -----------------------------------------------------------------------------
-- Deliverables & Milestones
-- -----------------------------------------------------------------------------
create type deliverable_status as enum ('not_started','in_progress','blocked','complete','cancelled');

create table public.deliverables (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  initiative_id   uuid references public.initiatives(id) on delete set null,
  milestone_id    uuid,
  title           text not null,
  description     text,
  acceptance_criteria text,
  owner_id        uuid references public.profiles(id),
  due_date        date,
  status          deliverable_status not null default 'not_started',
  completed_at    timestamptz,
  evidence_document_id uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_deliv_project on public.deliverables(project_id);
create index idx_deliv_owner on public.deliverables(owner_id) where status not in ('complete','cancelled');
create index idx_deliv_due on public.deliverables(due_date) where status not in ('complete','cancelled');
create trigger trg_deliv_updated before update on public.deliverables
  for each row execute function public.tg_set_updated_at();

alter table public.deliverables
  add constraint deliv_evidence_fk foreign key (evidence_document_id)
  references public.documents(id) on delete set null;

alter table public.documents
  add constraint doc_deliverable_fk foreign key (deliverable_id)
  references public.deliverables(id) on delete set null;

create table public.milestones (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  name            text not null,
  target_date     date not null,
  day_marker      smallint,    -- 30 / 60 / 90 sprints
  status          deliverable_status not null default 'not_started',
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_milestones_project on public.milestones(project_id, target_date);
create trigger trg_milestones_updated before update on public.milestones
  for each row execute function public.tg_set_updated_at();

alter table public.deliverables
  add constraint deliv_milestone_fk foreign key (milestone_id)
  references public.milestones(id) on delete set null;

-- -----------------------------------------------------------------------------
-- Risks & Issues
-- -----------------------------------------------------------------------------
create type risk_severity as enum ('low','medium','high','critical');
create type risk_likelihood as enum ('rare','unlikely','possible','likely','almost_certain');
create type risk_status as enum ('open','mitigating','closed','accepted');

create table public.risks (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  initiative_id   uuid references public.initiatives(id) on delete set null,
  title           text not null,
  description     text,
  severity        risk_severity not null default 'medium',
  likelihood      risk_likelihood not null default 'possible',
  score           smallint,
  status          risk_status not null default 'open',
  mitigation      text,
  owner_id        uuid references public.profiles(id),
  next_review_at  date,
  related_deliverable_id uuid references public.deliverables(id) on delete set null,
  related_budget_line_id uuid references public.budget_lines(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_risks_project on public.risks(project_id);
create index idx_risks_open on public.risks(project_id) where status in ('open','mitigating');
create trigger trg_risks_updated before update on public.risks
  for each row execute function public.tg_set_updated_at();

-- Compute score (1..25) on upsert
create or replace function public.tg_risk_score()
returns trigger language plpgsql as $$
declare
  sev int := case new.severity
    when 'low' then 1 when 'medium' then 2 when 'high' then 3 when 'critical' then 4 end;
  lik int := case new.likelihood
    when 'rare' then 1 when 'unlikely' then 2 when 'possible' then 3
    when 'likely' then 4 when 'almost_certain' then 5 end;
begin
  new.score = sev * lik;
  return new;
end $$;

create trigger trg_risks_score before insert or update on public.risks
  for each row execute function public.tg_risk_score();

create table public.risk_review_log (
  id              uuid primary key default gen_random_uuid(),
  risk_id         uuid not null references public.risks(id) on delete cascade,
  actor_id        uuid references public.profiles(id),
  notes           text,
  from_status     risk_status,
  to_status       risk_status,
  created_at      timestamptz not null default now()
);

create table public.issues (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  initiative_id   uuid references public.initiatives(id) on delete set null,
  title           text not null,
  description     text,
  severity        risk_severity not null default 'medium',
  status          text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  owner_id        uuid references public.profiles(id),
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_issues_updated before update on public.issues
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.portfolios      enable row level security;
alter table public.programmes      enable row level security;
alter table public.budget_lines    enable row level security;
alter table public.budget_actuals  enable row level security;
alter table public.deliverables    enable row level security;
alter table public.milestones      enable row level security;
alter table public.risks           enable row level security;
alter table public.risk_review_log enable row level security;
alter table public.issues          enable row level security;

create policy pf_read on public.portfolios for select using (
  organisation_id = public.current_org_id() or public.is_platform_admin()
);
create policy pf_write on public.portfolios for all using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy pg_read on public.programmes for select using (
  organisation_id = public.current_org_id() or public.is_platform_admin()
);
create policy pg_write on public.programmes for all using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy bl_read on public.budget_lines for select using (
  organisation_id = public.current_org_id() or public.is_platform_admin()
);
create policy bl_write on public.budget_lines for all using (
  public.has_project_role(project_id, array['pmo','tmo','sponsor','finance_controller']::member_role[])
  or public.is_platform_admin()
) with check (organisation_id = public.current_org_id());

create policy ba_read on public.budget_actuals for select using (
  exists(select 1 from public.budget_lines bl where bl.id = budget_line_id
         and (public.is_project_member(bl.project_id) or public.is_platform_admin()))
);
create policy ba_write on public.budget_actuals for all using (
  exists(select 1 from public.budget_lines bl where bl.id = budget_line_id
         and (public.has_project_role(bl.project_id,
              array['pmo','tmo','finance_controller']::member_role[])
              or public.is_platform_admin()))
) with check (true);

create policy deliv_read on public.deliverables for select using (
  organisation_id = public.current_org_id() or public.is_platform_admin()
);
create policy deliv_write on public.deliverables for all using (
  public.is_project_member(project_id) or public.is_platform_admin()
) with check (organisation_id = public.current_org_id());

create policy ms_read on public.milestones for select using (
  public.is_project_member(project_id) or public.is_platform_admin()
);
create policy ms_write on public.milestones for all using (
  public.has_project_role(project_id, array['pmo','tmo','sponsor','delivery_lead']::member_role[])
  or public.is_platform_admin()
) with check (organisation_id = public.current_org_id());

create policy risk_read on public.risks for select using (
  organisation_id = public.current_org_id() or public.is_platform_admin()
);
create policy risk_write on public.risks for all using (
  public.is_project_member(project_id) or public.is_platform_admin()
) with check (organisation_id = public.current_org_id());

create policy rrlog_read on public.risk_review_log for select using (
  exists(select 1 from public.risks r where r.id = risk_id
         and (public.is_project_member(r.project_id) or public.is_platform_admin()))
);
create policy rrlog_insert on public.risk_review_log for insert with check (
  exists(select 1 from public.risks r where r.id = risk_id
         and public.is_project_member(r.project_id))
);

create policy issue_read on public.issues for select using (
  public.is_project_member(project_id) or public.is_platform_admin()
);
create policy issue_write on public.issues for all using (
  public.is_project_member(project_id) or public.is_platform_admin()
) with check (organisation_id = public.current_org_id());

-- <<< END supabase/migrations/20260417000200_phase2_governance.sql

-- >>> BEGIN supabase/migrations/20260417000300_phase3_insights.sql
-- =============================================================================
-- Phase 3 — Insights & Gap Analysis
-- =============================================================================

create type insight_kind as enum (
  'weekly_digest','anomaly','pattern','compliance_gap','reporting_gap',
  'resource_gap','dependency_gap','predictive'
);

create type insight_severity as enum ('info','notice','warn','critical');

create table public.ai_insights (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  scope           text not null check (scope in ('organisation','portfolio','programme','project')),
  scope_id        uuid,
  kind            insight_kind not null,
  severity        insight_severity not null default 'info',
  headline        text not null,
  body_md         text,
  supporting_data jsonb,
  generated_at    timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.profiles(id),
  expires_at      timestamptz
);
create index idx_ai_insights_scope on public.ai_insights(scope, scope_id, generated_at desc);

create table public.insight_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  scope           text not null,
  scope_id        uuid,
  channels        text[] not null default array['email'],
  cadence         text not null default 'weekly',
  unique (profile_id, scope, scope_id)
);

create table public.alerts (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id      uuid references public.projects(id) on delete cascade,
  kind            text not null,
  severity        insight_severity not null default 'notice',
  title           text not null,
  body            text,
  fired_at        timestamptz not null default now(),
  resolved_at     timestamptz
);
create index idx_alerts_project on public.alerts(project_id, fired_at desc);

create table public.attention_list_snapshots (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  generated_at    timestamptz not null default now(),
  items           jsonb not null
);

-- Full-text search surface across submissions, deliverables, risks, documents
create table public.search_index (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id      uuid references public.projects(id) on delete cascade,
  entity_type     text not null,
  entity_id       uuid not null,
  title           text not null,
  body            text,
  url_path        text,
  tsv             tsvector,
  created_at      timestamptz not null default now()
);
create index idx_search_tsv on public.search_index using gin(tsv);
create index idx_search_project on public.search_index(project_id);

create or replace function public.tg_search_tsv()
returns trigger language plpgsql as $$
begin
  new.tsv = setweight(to_tsvector('english', coalesce(new.title,'')), 'A')
         || setweight(to_tsvector('english', coalesce(new.body,'')), 'B');
  return new;
end $$;

create trigger trg_search_tsv before insert or update on public.search_index
  for each row execute function public.tg_search_tsv();

-- RLS
alter table public.ai_insights              enable row level security;
alter table public.insight_subscriptions    enable row level security;
alter table public.alerts                   enable row level security;
alter table public.attention_list_snapshots enable row level security;
alter table public.search_index             enable row level security;

create policy ai_read on public.ai_insights for select using (
  organisation_id = public.current_org_id()
  and (scope <> 'project' or scope_id is null or public.is_project_member(scope_id) or public.is_platform_admin())
);
create policy ai_ack on public.ai_insights for update using (
  organisation_id = public.current_org_id()
) with check (organisation_id = public.current_org_id());

create policy sub_read on public.insight_subscriptions for select using (
  profile_id = auth.uid() or public.is_platform_admin()
);
create policy sub_write on public.insight_subscriptions for all using (
  profile_id = auth.uid() or public.is_platform_admin()
) with check (profile_id = auth.uid() or public.is_platform_admin());

create policy alert_read on public.alerts for select using (
  organisation_id = public.current_org_id()
  and (project_id is null or public.is_project_member(project_id) or public.is_platform_admin())
);

create policy attn_read on public.attention_list_snapshots for select using (
  organisation_id = public.current_org_id() or public.is_platform_admin()
);

create policy search_read on public.search_index for select using (
  organisation_id = public.current_org_id()
  and (project_id is null or public.is_project_member(project_id) or public.is_platform_admin())
);

-- <<< END supabase/migrations/20260417000300_phase3_insights.sql

-- >>> BEGIN supabase/migrations/20260417000400_phase4_integration_audit.sql
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

-- <<< END supabase/migrations/20260417000400_phase4_integration_audit.sql

-- >>> BEGIN supabase/migrations/20260417000500_auto_attach_org.sql
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

-- <<< END supabase/migrations/20260417000500_auto_attach_org.sql

-- >>> BEGIN supabase/seed/iris.sql
-- =============================================================================
-- Seed data for Johor Corporation HoldCo + Project IRIS
-- Run with: supabase db reset  (re-applies migrations then runs seed.sql)
-- Or:       psql $DATABASE_URL -f supabase/seed/iris.sql
-- =============================================================================

-- Note: auth.users rows cannot be created purely from SQL in hosted Supabase
-- without the service_role key. These profile rows are placeholders matched
-- to auth.users seeded via the API in scripts/seed-users.ts, but we keep the
-- IDs deterministic here so integration tests stay stable.

-- -----------------------------------------------------------------------------
-- Organisation
-- -----------------------------------------------------------------------------
insert into public.organisations (id, slug, name, domain, brand_primary, region)
values (
  '00000000-0000-0000-0000-000000000001',
  'jcorp',
  'Johor Corporation HoldCo',
  'jcorp.my',
  '#0284c7',
  'ap-southeast-1'
) on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Default submission template (IRIS 5-module form)
-- -----------------------------------------------------------------------------
insert into public.submission_templates (id, organisation_id, name, description, is_default, modules)
values (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'IRIS Weekly Update (Default)',
  'Default 5-module weekly submission: Header, Progress, Risks, Documents, Narrative',
  true,
  '[
    {"key":"header","title":"Header","fields":[
      {"key":"period_start","type":"date","label":"Reporting period start","required":true},
      {"key":"period_end","type":"date","label":"Reporting period end","required":true}
    ]},
    {"key":"progress","title":"Progress & Status","fields":[
      {"key":"rag","type":"rag","label":"RAG","required":true},
      {"key":"progress_pct","type":"number","label":"Completion %","required":true},
      {"key":"headline","type":"short_text","label":"Headline","required":true},
      {"key":"progress_notes","type":"long_text","label":"Progress notes","required":true}
    ]},
    {"key":"risks","title":"Risks & Issues","fields":[
      {"key":"risks_text","type":"long_text","label":"Active risks this week"},
      {"key":"issues_text","type":"long_text","label":"Open issues this week"},
      {"key":"escalate","type":"toggle","label":"Escalate to TMO?"},
      {"key":"escalate_reason","type":"long_text","label":"Reason for escalation",
        "visible_when":{"escalate":true}}
    ]},
    {"key":"documents","title":"Evidence & Deliverables","fields":[
      {"key":"uploads","type":"file","label":"Upload supporting documents (≤10MB each)",
        "tags":["evidence","deliverable","reference","other"]}
    ]},
    {"key":"narrative","title":"Narrative","fields":[
      {"key":"narrative","type":"long_text","label":"Free-form narrative for TMO"}
    ]}
  ]'::jsonb
) on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Portfolio + Programme
-- -----------------------------------------------------------------------------
insert into public.portfolios (id, organisation_id, code, name, description)
values (
  '20000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'DIGITAL_TX',
  'Digital Transformation Portfolio',
  'Group-level digital transformation portfolio'
) on conflict (id) do nothing;

insert into public.programmes (id, organisation_id, portfolio_id, code, name)
values (
  '30000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'PMO_PLATFORM',
  'PMO Platform Programme'
) on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Project IRIS
-- -----------------------------------------------------------------------------
insert into public.projects (
  id, organisation_id, code, name, description, department,
  status, rag, cadence, template_id, portfolio_id, programme_id,
  submission_deadline_dow, submission_deadline_time, report_day_dow, report_time,
  start_date, target_end_date
) values (
  '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'IRIS',
  'Project IRIS',
  'Group-wide integrated reporting & insights initiative — 8 initiatives across HR, Finance, Operations, Strategy.',
  'Transformation Office',
  'active', 'amber', 'weekly',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  1, '15:00', 2, '14:00',
  date '2026-04-06', date '2026-12-31'
) on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 8 IRIS initiatives
-- -----------------------------------------------------------------------------
insert into public.initiatives (id, organisation_id, project_id, code, name, sort_order) values
('41000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'PHI_01', 'People & HR Insights',          1),
('41000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'PHI_02', 'Payroll Harmonisation',         2),
('41000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'FIN_01', 'Finance Reporting Uplift',      3),
('41000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'OPS_01', 'Operations Dashboard',          4),
('41000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'CPS_01', 'Customer Platform Sunset',      5),
('41000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'STR_01', 'Strategy Cascade',              6),
('41000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'DAT_01', 'Data Platform Foundation',      7),
('41000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'PER_01', 'Performance Management Reset',  8)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Budget lines (illustrative)
-- -----------------------------------------------------------------------------
insert into public.budget_lines (organisation_id, project_id, initiative_id, year, quarter, category, description, currency, planned_amount)
select
  '00000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  i.id, 2026, 2, 'opex',
  i.name || ' — Q2 delivery',
  'MYR',
  (array[280000,220000,310000,195000,175000,140000,420000,160000])[i.sort_order]
from public.initiatives i
where i.project_id = '40000000-0000-0000-0000-000000000001'
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Phase-0 milestones
-- -----------------------------------------------------------------------------
insert into public.milestones (organisation_id, project_id, name, target_date, day_marker) values
('00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'IRIS 30-day sprint',  date '2026-05-06', 30),
('00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'IRIS 60-day sprint',  date '2026-06-05', 60),
('00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'IRIS 90-day sprint',  date '2026-07-05', 90)
on conflict do nothing;

-- <<< END supabase/seed/iris.sql

