-- =============================================================================
-- Add `priority` column to projects. Idempotent — safe to re-run.
-- Paste into Azure Portal → bbai → Query editor → Run.
-- =============================================================================

DO $$
BEGIN
  CREATE TYPE project_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS priority project_priority NOT NULL DEFAULT 'medium';

-- Bump the default on IRIS so the card shows a non-trivial badge without
-- requiring anyone to touch the row manually.
UPDATE public.projects
SET priority = 'high'
WHERE code = 'IRIS' AND priority = 'medium';
