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
