-- =============================================================================
-- Portfolio governance + initiative dates.
-- Idempotent. Paste into Azure Portal → bbai → Query editor → Run.
-- =============================================================================

-- 1. Portfolios get division / department / RBAC
ALTER TABLE public.portfolios
  ADD COLUMN IF NOT EXISTS division        text,
  ADD COLUMN IF NOT EXISTS department      text,
  ADD COLUMN IF NOT EXISTS access_mode     text NOT NULL DEFAULT 'public'
    CHECK (access_mode IN ('public','restricted')),
  ADD COLUMN IF NOT EXISTS allowed_entra_groups text[] NOT NULL DEFAULT '{}';

-- 2. Initiatives get start / target_end dates so the Gantt has data.
ALTER TABLE public.initiatives
  ADD COLUMN IF NOT EXISTS start_date      date,
  ADD COLUMN IF NOT EXISTS target_end_date date;

-- 3. Backfill initiative dates from the parent project where missing,
--    so existing rows render on the Gantt without manual entry.
UPDATE public.initiatives i
SET start_date      = p.start_date,
    target_end_date = p.target_end_date
FROM public.projects p
WHERE i.project_id = p.id
  AND i.start_date IS NULL
  AND i.target_end_date IS NULL;

-- 4. Default the IRIS portfolio to the right division/department so it
--    isn't blank after the columns appear.
UPDATE public.portfolios
SET division   = 'STRATEGY & INVESTMENT DIVISION',
    department = 'PORTFOLIO MANAGEMENT DEPARTMENT'
WHERE code = 'IRIS_PORTFOLIO'
  AND division IS NULL;
