-- =============================================================================
-- Enforce: project names are unique within an organisation (case-insensitive).
-- Idempotent — safe to re-run.
-- Paste into Azure Portal → bbai → Query editor → Run.
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_org_name_unique
  ON public.projects (organisation_id, lower(name));

-- Companion index for case-insensitive lookups by name (e.g. duplicate
-- check before INSERT).
CREATE INDEX IF NOT EXISTS idx_projects_org_name_lower
  ON public.projects (organisation_id, lower(name));
