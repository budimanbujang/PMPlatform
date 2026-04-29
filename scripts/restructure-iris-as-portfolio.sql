-- =============================================================================
-- Restructure IRIS as a Portfolio with 6 P-projects.
--
-- Before:
--   Portfolio: "Digital Transformation Portfolio" (code DIGITAL_TX)
--     └─ Project: "Project IRIS" (code IRIS) with 8 demo initiatives
--
-- After:
--   Portfolio: "Project IRIS" (code IRIS_PORTFOLIO)
--     ├─ Project: Philosophy   (IRIS_PHI)   ── PHI_01, PHI_02
--     ├─ Project: Process      (IRIS_PRO)   ── PRO_01
--     ├─ Project: Policy       (IRIS_POL)   ── POL_01
--     ├─ Project: Platform     (IRIS_PLA)   ── PLA_01, PLA_02
--     ├─ Project: People       (IRIS_PEO)   ── PEO_01
--     └─ Project: Performance  (IRIS_PER)   ── PER_01
--
-- Old "Project IRIS" (with its budget lines + initiatives) is archived rather
-- than deleted so audit history + budget actuals you've already imported stay
-- queryable. Delete it from the UI later if you want.
--
-- Idempotent: ON CONFLICT clauses make every INSERT safe to re-run.
-- =============================================================================

BEGIN;

-- 1. Archive the old "Project IRIS" so it disappears from default views.
UPDATE public.projects
SET status = 'archived'
WHERE organisation_id = (SELECT id FROM public.organisations WHERE slug = 'jcorp')
  AND code = 'IRIS'
  AND status <> 'archived';

-- 2. Repurpose the existing portfolio so it represents IRIS itself.
UPDATE public.portfolios
SET code = 'IRIS_PORTFOLIO',
    name = 'Project IRIS',
    description = 'JCorp''s AI-first transformation across six pillars: Philosophy, Process, Policy, Platform, People, Performance.'
WHERE organisation_id = (SELECT id FROM public.organisations WHERE slug = 'jcorp')
  AND code = 'DIGITAL_TX';

-- 3. Insert the 6 P-projects under the IRIS portfolio.
INSERT INTO public.projects (
  organisation_id, code, name, description, department,
  status, rag, priority, cadence,
  template_id, portfolio_id,
  start_date, target_end_date
)
SELECT
  org.id,
  v.code,
  v.name,
  v.description,
  v.department,
  'active'::project_status,
  'amber'::project_rag,
  v.priority::project_priority,
  'weekly',
  tpl.id,
  pf.id,
  date '2026-04-06',
  date '2026-12-31'
FROM (SELECT id FROM public.organisations WHERE slug = 'jcorp')              AS org,
     (SELECT id FROM public.submission_templates WHERE is_default = true LIMIT 1) AS tpl,
     (SELECT id FROM public.portfolios WHERE code = 'IRIS_PORTFOLIO')         AS pf,
     (VALUES
       ('IRIS_PHI', 'Philosophy',  'Define the philosophical foundation for the AI-first transformation.', 'Transformation Office', 'high'),
       ('IRIS_PRO', 'Process',     'Redesign core operating processes around AI-first principles.',         'Transformation Office', 'high'),
       ('IRIS_POL', 'Policy',      'Establish AI governance, risk and regulatory frameworks.',              'Legal & Compliance',    'critical'),
       ('IRIS_PLA', 'Platform',    'Build the AI infrastructure that powers transformation.',               'Technology',            'high'),
       ('IRIS_PEO', 'People',      'Equip JCorp employees to thrive in an AI-first environment.',           'Human Capital',         'medium'),
       ('IRIS_PER', 'Performance', 'Measure and report success of the AI-first transformation.',            'Strategy & PMO',        'high')
     ) AS v(code, name, description, department, priority)
ON CONFLICT (organisation_id, code) DO NOTHING;

-- 4. Insert the initiatives under each P-project.
INSERT INTO public.initiatives (organisation_id, project_id, code, name, sort_order)
SELECT
  p.organisation_id,
  p.id,
  v.code,
  v.name,
  v.sort_order
FROM public.projects p
JOIN (VALUES
  ('IRIS_PHI', 'PHI_01', 'JCorp 4.0 Launch',             1),
  ('IRIS_PHI', 'PHI_02', 'IRIS Change Enablement',       2),
  ('IRIS_PRO', 'PRO_01', 'AI-First Workflow Redesign',   1),
  ('IRIS_POL', 'POL_01', 'AI Governance',                1),
  ('IRIS_PLA', 'PLA_01', 'AI Solution',                  1),
  ('IRIS_PLA', 'PLA_02', 'AI Data Platform',             2),
  ('IRIS_PEO', 'PEO_01', 'JCorp All-In Programme',       1),
  ('IRIS_PER', 'PER_01', 'AI-first Success Measurement', 1)
) AS v(project_code, code, name, sort_order)
  ON p.code = v.project_code
ON CONFLICT (project_id, code) DO NOTHING;

COMMIT;

-- =============================================================================
-- Verify
-- =============================================================================
-- SELECT pf.name AS portfolio, p.code, p.name AS project, COUNT(i.id) AS initiatives
-- FROM portfolios pf
-- JOIN projects p ON p.portfolio_id = pf.id
-- LEFT JOIN initiatives i ON i.project_id = p.id
-- WHERE pf.code = 'IRIS_PORTFOLIO'
-- GROUP BY pf.name, p.code, p.name
-- ORDER BY p.code;
