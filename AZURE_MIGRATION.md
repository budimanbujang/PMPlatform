# Data migration — Supabase → Azure Postgres

If your Supabase project had real data (not just the IRIS seed), copy it across before you shut Supabase down. Follow this once per environment.

**Estimated time:** 30–60 minutes depending on data volume.

---

## Before you start

- [ ] Azure schema applied via `scripts/azure-schema.sql` (creates empty tables + the IRIS seed)
- [ ] Users have **already signed in once via Entra** so their `profiles` rows exist on Azure. This matters because foreign keys like `projects.created_by` and `members.profile_id` must resolve.
- [ ] You have Supabase's `DATABASE_URL` (Supabase Dashboard → Settings → Database → URI with password)
- [ ] You have Azure Postgres credentials (`bbai_admin` + password)
- [ ] Both endpoints are reachable from wherever you run `pg_dump` / `psql` (Azure Cloud Shell works well)

---

## Step 1 — Export each table from Supabase (10 min)

Run in Azure Cloud Shell (or any shell with `pg_dump` installed).

```bash
SUPABASE_URL='postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres'
mkdir -p ~/pm-dump && cd ~/pm-dump

# Dump each table as plain-text INSERTs, schema-free (we already have the
# Azure schema applied).  Order matters: referenced tables first.
for t in organisations profiles submission_templates \
         portfolios programmes projects initiatives members \
         milestones deliverables submissions documents report_runs \
         budget_lines budget_actuals \
         risks risk_review_log issues \
         project_templates form_fields cadence_schedules project_lifecycle_events \
         ai_insights insight_subscriptions alerts attention_list_snapshots search_index \
         integrations integration_mappings audit_log permission_overrides data_retention_policies
do
  pg_dump "$SUPABASE_URL" --data-only --column-inserts --no-owner \
          -t "public.$t" -f "${t}.sql"
done
ls -la
```

Each file contains only `INSERT INTO public.<table> (…) VALUES (…);` rows.

---

## Step 2 — Sanity-check what you're about to load

```bash
wc -l *.sql                 # row counts
grep -c "INSERT" members.sql
```

Open `profiles.sql` and look at the first INSERT. Supabase's `profiles` rows have an `id` that came from `auth.users`. Azure's `profiles` rows have an `id` minted by `gen_random_uuid()` on first sign-in. **These will collide** if you don't map.

### Re-key profiles to match Azure IDs

Option A — simplest (recommended): don't restore `profiles` rows at all. Users sign in via Entra, their Azure profile is created fresh, and `is_platform_admin` + any hand-curated fields get re-applied manually via SQL after.

Option B — keep history: build a mapping table from Supabase email → Azure profile id, then rewrite the FKs. Only worth it if your `audit_log` / `lifecycle_events` audit history matters.

For IRIS (pilot phase) go with **A**. Delete `profiles.sql` before the restore:

```bash
rm profiles.sql
```

Before restoring, re-run this on Azure to make sure each user who had admin / org attachment gets it back:

```sql
-- Run on Azure after users have signed in
UPDATE profiles
SET is_platform_admin = true,
    organisation_id   = (SELECT id FROM organisations WHERE slug = 'jcorp')
WHERE lower(email) IN (
  'budiman.bujang@jcorp.com.my'
  -- add other admins
);
```

---

## Step 3 — Deal with FK columns that reference profiles

Supabase dump files reference Supabase profile UUIDs in columns like:
- `projects.created_by`, `projects.sponsor_id`
- `initiatives.champion_id`, `initiatives.io_id`
- `members.profile_id`
- `deliverables.owner_id`, `submissions.submitted_by`
- `documents.uploaded_by`, `risks.owner_id`, `issues.owner_id`
- `ai_insights.acknowledged_by`, `project_lifecycle_events.actor_id`, etc.

If you dropped `profiles.sql` (option A), these UUIDs won't match any row on Azure and the FKs will fail.

**Quick fix — null them out before restore:**

```bash
# Replace all UUIDs in the profile-referencing columns with NULL.
# Crude but effective for an MVP pilot.
sed -i.bak -E \
  -e 's/(created_by|sponsor_id|champion_id|io_id|profile_id|owner_id|submitted_by|uploaded_by|acknowledged_by|actor_id|recorded_by)\s*=\s*[a-f0-9-]{36}/\1 = NULL/gi' \
  projects.sql initiatives.sql members.sql deliverables.sql submissions.sql documents.sql risks.sql issues.sql ai_insights.sql project_lifecycle_events.sql budget_actuals.sql risk_review_log.sql
```

> **Warning:** The crude sed above targets `col = uuid` patterns. Supabase dumps tend to use positional INSERTs (`VALUES (...)`) — check a sample file first. If it uses positional inserts, you'll need a more careful transform (Python + CSV, or just drop the problem columns from the dump by regenerating with explicit `--exclude-table` and `--exclude-column`).

**Skip members entirely** — you'll re-assign people after login:

```bash
rm members.sql
```

---

## Step 4 — Restore to Azure (10 min)

```bash
AZURE_URL='postgresql://bbai_admin:<PASSWORD>@bbai.postgres.database.azure.com:5432/postgres?sslmode=require'

# The IRIS seed may conflict with incoming rows on `projects.code` unique
# constraints etc. Delete IRIS seed from Azure first if your Supabase dump
# includes the same project.
psql "$AZURE_URL" <<SQL
DELETE FROM initiatives  WHERE project_id = '40000000-0000-0000-0000-000000000001';
DELETE FROM budget_lines WHERE project_id = '40000000-0000-0000-0000-000000000001';
DELETE FROM milestones   WHERE project_id = '40000000-0000-0000-0000-000000000001';
DELETE FROM projects     WHERE id         = '40000000-0000-0000-0000-000000000001';
SQL

# Now restore in dependency order
for t in organisations submission_templates \
         portfolios programmes projects initiatives \
         milestones deliverables submissions documents report_runs \
         budget_lines budget_actuals \
         risks risk_review_log issues \
         project_templates form_fields cadence_schedules project_lifecycle_events \
         ai_insights insight_subscriptions alerts attention_list_snapshots search_index \
         integrations integration_mappings audit_log permission_overrides data_retention_policies
do
  [ -f "${t}.sql" ] || continue
  echo "→ ${t}"
  psql "$AZURE_URL" -v ON_ERROR_STOP=1 -f "${t}.sql"
done
```

If a table errors, open the file, find the offending row, fix the UUID (or drop the row), re-run.

---

## Step 5 — Re-attach users to projects

Since `members.sql` was skipped, you need to manually add Champions + TMOs back on Azure:

```sql
-- Example: make budiman a PMO on every active project
INSERT INTO members (organisation_id, project_id, profile_id, role)
SELECT
  p.organisation_id,
  p.id,
  (SELECT id FROM profiles WHERE email = 'budiman.bujang@jcorp.com.my'),
  'pmo'::member_role
FROM projects p
WHERE p.status = 'active'
ON CONFLICT DO NOTHING;

-- Example: assign a Champion to an initiative
UPDATE initiatives
SET champion_id = (SELECT id FROM profiles WHERE email = 'champion@jcorp.com.my')
WHERE code = 'PHI_01';
```

---

## Step 6 — Migrate storage (documents + reports)

Azure Blob doesn't replicate from Supabase Storage automatically. Two paths:

### Option A — leave old files behind
Accept that submissions filed before the migration have broken download links. Fine for pilot.

### Option B — copy the blobs
```bash
# Requires azcopy and the Supabase service_role key
SUPABASE_PROJECT='<ref>'
SUPABASE_SERVICE_ROLE='<key>'
AZURE_ACCOUNT='bbaistorage'
AZURE_SAS='?<sas-token-from-portal>'

# Download each bucket
for bucket in project-documents reports; do
  mkdir -p "./$bucket"
  # List every object, then curl each down.  Supabase's storage API doesn't
  # have a cheap bulk download, so use their REST `list` + download.
  # Detailed script omitted — do it if/when you need history preserved.
done

# Upload to Azure
azcopy copy "./project-documents/*" \
  "https://${AZURE_ACCOUNT}.blob.core.windows.net/project-documents${AZURE_SAS}" \
  --recursive
azcopy copy "./reports/*" \
  "https://${AZURE_ACCOUNT}.blob.core.windows.net/reports${AZURE_SAS}" \
  --recursive
```

Finally update `documents.storage_path` and `report_runs.pdf_path` to match the new container structure if the bucket layout differs. They shouldn't — we kept `<org>/<project>/<submission>/<filename>` for both.

---

## Step 7 — Cut DNS, shut Supabase down

When the Azure app is validated and users are in:

1. Update any external references (email signatures, documentation) that link to Vercel/Supabase.
2. **Do not delete the Supabase project yet.** Keep it read-only for 30 days as fallback.
3. Pause the Vercel project (Settings → General → Pause).
4. After 30 days of no issues, delete both.

---

## Rollback plan

If the Azure stack breaks and you need to go back fast:

1. Re-enable Vercel project.
2. Restore the **last pre-migration** Vercel deployment (Deployments → pick one from before `13feef0` → Promote).
3. Users sign in via Supabase again (still works — we never touched Supabase auth/data).

Rollback works cleanly because we never mutated Supabase during the migration; we only read from it.
