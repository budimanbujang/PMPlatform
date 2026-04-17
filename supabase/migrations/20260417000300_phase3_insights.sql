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
