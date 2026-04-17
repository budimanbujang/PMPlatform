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
