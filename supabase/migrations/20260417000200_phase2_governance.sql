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
