-- =============================================================================
-- JCorp PMPlatform — Azure Postgres schema + seed
--
-- Paste the ENTIRE file into Azure Portal → bbai → Query editor → Run.
-- Safe to run against an empty `postgres` database. Not idempotent (running
-- twice will error with "type already exists" — DROP TYPE first if needed).
--
-- Matches the Drizzle schema in src/lib/db/schema.ts. Excludes the Supabase
-- auth schema, RLS policies, and the handle_new_user trigger — authorization
-- moves to the application layer (NextAuth + lib/auth/authz).
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- -----------------------------------------------------------------------------
-- Helper functions
-- -----------------------------------------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type project_status as enum ('draft','active','on_hold','closed','archived');
create type project_rag as enum ('green','amber','red','grey');
create type member_role as enum ('sponsor','executive','pmo','tmo','iwc','champion','io','delivery_lead','finance_controller','steering','viewer');
create type document_tag as enum ('evidence','deliverable','reference','other');
create type submission_status as enum ('draft','submitted','late','missed','void');
create type report_status as enum ('queued','generating','succeeded','failed');
create type form_field_type as enum ('rag','number','currency','short_text','long_text','date','file','toggle','dropdown','multi_select','user_picker');
create type budget_category as enum ('capex','opex','vendor','licensing','people','contingency','other');
create type deliverable_status as enum ('not_started','in_progress','blocked','complete','cancelled');
create type risk_severity as enum ('low','medium','high','critical');
create type risk_likelihood as enum ('rare','unlikely','possible','likely','almost_certain');
create type risk_status as enum ('open','mitigating','closed','accepted');
create type insight_kind as enum ('weekly_digest','anomaly','pattern','compliance_gap','reporting_gap','resource_gap','dependency_gap','predictive');
create type insight_severity as enum ('info','notice','warn','critical');

-- -----------------------------------------------------------------------------
-- organisations
-- -----------------------------------------------------------------------------
create table public.organisations (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  brand_primary text default '#b87d07',
  brand_logo    text,
  domain        text,
  region        text default 'ap-southeast-1',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_orgs_updated before update on public.organisations
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- profiles (no auth.users FK — NextAuth session id lives in entra_oid)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key default gen_random_uuid(),
  organisation_id   uuid references public.organisations(id) on delete set null,
  email             text not null unique,
  full_name         text,
  avatar_url        text,
  job_title         text,
  department        text,
  is_platform_admin boolean not null default false,
  entra_oid         text unique,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- submission_templates
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
create trigger trg_tpl_updated before update on public.submission_templates
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- portfolios + programmes
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
create trigger trg_pf_updated before update on public.portfolios
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
create trigger trg_pg_updated before update on public.programmes
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- projects
-- -----------------------------------------------------------------------------
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
  cadence         text not null default 'weekly',
  submission_deadline_dow smallint default 1,
  submission_deadline_time time default '15:00',
  report_day_dow  smallint default 2,
  report_time     time default '14:00',
  template_id     uuid references public.submission_templates(id) on delete set null,
  programme_id    uuid references public.programmes(id) on delete set null,
  portfolio_id    uuid references public.portfolios(id) on delete set null,
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
-- initiatives
-- -----------------------------------------------------------------------------
create table public.initiatives (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  code            text not null,
  name            text not null,
  description     text,
  champion_id     uuid references public.profiles(id),
  io_id           uuid references public.profiles(id),
  rag             project_rag not null default 'grey',
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (project_id, code)
);
create index idx_initiatives_project on public.initiatives(project_id);
create trigger trg_init_updated before update on public.initiatives
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- members
-- -----------------------------------------------------------------------------
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
-- submissions
-- -----------------------------------------------------------------------------
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
  progress_pct    smallint,
  headline        text,
  progress_notes  text,
  risks_text      text,
  issues_text     text,
  narrative       text,
  escalate        boolean not null default false,
  escalate_reason text,
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (initiative_id, period_start)
);
create index idx_submissions_project_period on public.submissions(project_id, period_start);
create index idx_submissions_status on public.submissions(status);
create trigger trg_subm_updated before update on public.submissions
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- milestones + deliverables + documents + report_runs
-- -----------------------------------------------------------------------------
create table public.milestones (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  name            text not null,
  target_date     date not null,
  day_marker      smallint,
  status          deliverable_status not null default 'not_started',
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_milestones_project on public.milestones(project_id, target_date);
create trigger trg_ms_updated before update on public.milestones
  for each row execute function public.tg_set_updated_at();

create table public.deliverables (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  initiative_id   uuid references public.initiatives(id) on delete set null,
  milestone_id    uuid references public.milestones(id) on delete set null,
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
create index idx_deliv_owner on public.deliverables(owner_id);
create index idx_deliv_due on public.deliverables(due_date);
create trigger trg_del_updated before update on public.deliverables
  for each row execute function public.tg_set_updated_at();

create table public.documents (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id      uuid references public.projects(id) on delete cascade,
  initiative_id   uuid references public.initiatives(id) on delete set null,
  submission_id   uuid references public.submissions(id) on delete cascade,
  deliverable_id  uuid references public.deliverables(id) on delete set null,
  storage_path    text not null,
  file_name       text not null,
  mime_type       text,
  size_bytes      integer,
  tag             document_tag not null default 'other',
  description     text,
  uploaded_by     uuid references public.profiles(id),
  created_at      timestamptz not null default now()
);
create index idx_documents_project on public.documents(project_id);
create index idx_documents_submission on public.documents(submission_id);

alter table public.deliverables
  add constraint deliv_evidence_fk foreign key (evidence_document_id)
  references public.documents(id) on delete set null;

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

-- -----------------------------------------------------------------------------
-- budget
-- -----------------------------------------------------------------------------
create table public.budget_lines (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  initiative_id   uuid references public.initiatives(id) on delete set null,
  year            integer not null,
  quarter         smallint,
  category        budget_category not null default 'other',
  description     text not null,
  currency        text not null default 'MYR',
  planned_amount  numeric(18,2) not null default 0,
  committed_amount numeric(18,2) not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_budget_project on public.budget_lines(project_id, year);
create trigger trg_bud_updated before update on public.budget_lines
  for each row execute function public.tg_set_updated_at();

create table public.budget_actuals (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  budget_line_id  uuid not null references public.budget_lines(id) on delete cascade,
  period_end      date not null,
  actual_amount   numeric(18,2) not null,
  source          text default 'manual',
  reference       text,
  recorded_by     uuid references public.profiles(id),
  created_at      timestamptz not null default now()
);
create index idx_actuals_line on public.budget_actuals(budget_line_id, period_end);

create or replace view public.v_project_budget_summary as
select
  p.id as project_id,
  p.organisation_id,
  coalesce(sum(bl.planned_amount), 0)   as planned_total,
  coalesce(sum(bl.committed_amount), 0) as committed_total,
  coalesce(sum(ba.actual_amount), 0)    as actual_total,
  case when coalesce(sum(bl.planned_amount), 0) > 0
       then round( (coalesce(sum(ba.actual_amount),0) - coalesce(sum(bl.planned_amount),0))
                   / coalesce(sum(bl.planned_amount),0) * 100, 2)
       else 0 end as variance_pct
from public.projects p
left join public.budget_lines bl on bl.project_id = p.id
left join public.budget_actuals ba on ba.budget_line_id = bl.id
group by p.id, p.organisation_id;

-- -----------------------------------------------------------------------------
-- risks + issues
-- -----------------------------------------------------------------------------
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
create trigger trg_risks_updated before update on public.risks
  for each row execute function public.tg_set_updated_at();
create trigger trg_risks_score before insert or update on public.risks
  for each row execute function public.tg_risk_score();

create table public.risk_review_log (
  id          uuid primary key default gen_random_uuid(),
  risk_id     uuid not null references public.risks(id) on delete cascade,
  actor_id    uuid references public.profiles(id),
  notes       text,
  from_status risk_status,
  to_status   risk_status,
  created_at  timestamptz not null default now()
);

create table public.issues (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  initiative_id   uuid references public.initiatives(id) on delete set null,
  title           text not null,
  description     text,
  severity        risk_severity not null default 'medium',
  status          text not null default 'open',
  owner_id        uuid references public.profiles(id),
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_iss_updated before update on public.issues
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- phase 1 — templates / cadence / lifecycle
-- -----------------------------------------------------------------------------
create table public.project_templates (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  kind            text not null,
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

create table public.form_fields (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.submission_templates(id) on delete cascade,
  module_key    text not null,
  field_key     text not null,
  label         text not null,
  help_text     text,
  field_type    form_field_type not null,
  required      boolean not null default false,
  visible_roles member_role[],
  options       jsonb,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  unique (template_id, field_key)
);

create table public.cadence_schedules (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  role           member_role not null,
  deadline_dow   smallint not null,
  deadline_time  time not null,
  reminder_lead_hours integer not null default 24,
  unique (project_id, role)
);

create table public.project_lifecycle_events (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  from_status project_status,
  to_status   project_status not null,
  reason      text,
  actor_id    uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);
create index idx_lifecycle_project on public.project_lifecycle_events(project_id, created_at);

-- -----------------------------------------------------------------------------
-- phase 3 — insights / alerts / search
-- -----------------------------------------------------------------------------
create table public.ai_insights (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  scope           text not null,
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
create index idx_ai_insights_scope on public.ai_insights(scope, scope_id, generated_at);

create table public.insight_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  scope           text not null,
  scope_id        uuid,
  channels        text[] not null default array['email']::text[],
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
create index idx_alerts_project on public.alerts(project_id, fired_at);

create table public.attention_list_snapshots (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  generated_at    timestamptz not null default now(),
  items           jsonb not null
);

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

-- -----------------------------------------------------------------------------
-- phase 4 — integrations / audit
-- -----------------------------------------------------------------------------
create table public.integrations (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  kind            text not null,
  name            text not null,
  config          jsonb not null default '{}'::jsonb,
  secret_ref      text,
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
create index idx_audit_entity on public.audit_log(entity_type, entity_id, at);
create index idx_audit_actor on public.audit_log(actor_id, at);

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

-- =============================================================================
-- SEED — JCorp + IRIS
-- =============================================================================

-- Organisation
insert into public.organisations (id, slug, name, domain, region)
values (
  '00000000-0000-0000-0000-000000000001',
  'jcorp',
  'Johor Corporation HoldCo',
  'jcorp.com.my',
  'ap-southeast-1'
);

-- Default submission template (IRIS 5-module form)
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
      {"key":"escalate_reason","type":"long_text","label":"Reason for escalation"}
    ]},
    {"key":"documents","title":"Evidence & Deliverables","fields":[
      {"key":"uploads","type":"file","label":"Upload supporting documents (<=10MB each)"}
    ]},
    {"key":"narrative","title":"Narrative","fields":[
      {"key":"narrative","type":"long_text","label":"Free-form narrative for TMO"}
    ]}
  ]'::jsonb
);

-- Portfolio + programme
insert into public.portfolios (id, organisation_id, code, name, description)
values (
  '20000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'DIGITAL_TX',
  'Digital Transformation Portfolio',
  'Group-level digital transformation portfolio'
);

insert into public.programmes (id, organisation_id, portfolio_id, code, name)
values (
  '30000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'PMO_PLATFORM',
  'PMO Platform Programme'
);

-- Project IRIS
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
);

-- 8 IRIS initiatives
insert into public.initiatives (id, organisation_id, project_id, code, name, sort_order) values
('41000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'PHI_01', 'People & HR Insights',          1),
('41000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'PHI_02', 'Payroll Harmonisation',         2),
('41000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'FIN_01', 'Finance Reporting Uplift',      3),
('41000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'OPS_01', 'Operations Dashboard',          4),
('41000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'CPS_01', 'Customer Platform Sunset',      5),
('41000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'STR_01', 'Strategy Cascade',              6),
('41000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'DAT_01', 'Data Platform Foundation',      7),
('41000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'PER_01', 'Performance Management Reset',  8);

-- Budget lines (Q2 2026 plan)
insert into public.budget_lines (organisation_id, project_id, initiative_id, year, quarter, category, description, currency, planned_amount)
select
  '00000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  i.id, 2026, 2, 'opex',
  i.name || ' — Q2 delivery',
  'MYR',
  (array[280000,220000,310000,195000,175000,140000,420000,160000])[i.sort_order]
from public.initiatives i
where i.project_id = '40000000-0000-0000-0000-000000000001';

-- Milestones
insert into public.milestones (organisation_id, project_id, name, target_date, day_marker) values
('00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'IRIS 30-day sprint',  date '2026-05-06', 30),
('00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'IRIS 60-day sprint',  date '2026-06-05', 60),
('00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'IRIS 90-day sprint',  date '2026-07-05', 90);

commit;

-- =============================================================================
-- Done. After this runs, sign in via the web app with your JCorp email.
-- NextAuth will create your profile row automatically. Then promote yourself:
--
--   update public.profiles
--   set is_platform_admin = true
--   where email = 'budiman.bujang@jcorp.com.my';
-- =============================================================================
