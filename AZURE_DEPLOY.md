# Deploying to Azure App Service (hybrid — keeping Supabase)

Moves only the Next.js application from Vercel to Azure App Service. Supabase continues to host the database, auth, and file storage. Azure Postgres migration is a later phase.

**Estimated time:** 1.5 hours end-to-end.

---

## Prerequisites you've already done

- Supabase project up, schema applied, IRIS seed loaded, your profile row attached + platform admin set
- (Optional but recommended) Finish the Supabase version working on Vercel first, so you have a reference for "this is what it should look like when it works"

If you haven't run the profile-fix SQL yet, do that now:

```sql
update public.organisations set domain = 'jcorp.com.my' where slug = 'jcorp';

insert into public.profiles (id, organisation_id, email, full_name, is_platform_admin)
select
  u.id,
  (select id from public.organisations where slug = 'jcorp'),
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  true
from auth.users u
where lower(u.email) = lower('budiman.bujang@jcorp.com.my')
on conflict (id) do update
  set organisation_id = excluded.organisation_id,
      is_platform_admin = true,
      email = excluded.email;
```

---

## Step 1 — Create the App Service (15 min)

1. Azure Portal → **Create a resource** → search **Web App** → **Create**.
2. Fill in:
   - **Subscription** / **Resource Group** — use your existing ones
   - **Name** — `jcorp-pmo` (this becomes part of the URL: `jcorp-pmo.azurewebsites.net`)
   - **Publish** — **Code**
   - **Runtime stack** — **Node 20 LTS**
   - **Operating System** — **Linux**
   - **Region** — **Southeast Asia** (Singapore) to match your Supabase region
3. **App Service Plan**:
   - If you don't have one: **Create new** → Plan name `jcorp-pmo-plan`
   - **Pricing plan** — **Basic B1** (MYR ~60/month) is the minimum for production. **Free F1** works for testing but sleeps after 20 min idle and has 60-min CPU limit.
4. Skip **Database** and **Deployment** tabs — we handle deploy via GitHub Actions below.
5. **Networking** → Enable public access: Yes.
6. **Monitoring** → Application Insights: recommended, **Yes**. Creates a resource that shows logs + telemetry.
7. **Review + create** → **Create**. Wait ~2 min.

---

## Step 2 — Configure environment variables (10 min)

Azure Portal → your new Web App → left sidebar: **Settings → Environment variables** (or **Configuration** on older portal versions).

Click **+ Add** once per variable. For each, set **Name**, **Value**, and leave **Deployment slot setting** unchecked unless you use slots.

### Required variables

| Name | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | From Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGc...` | Same page |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGc...` | Same page, **Reveal** the service_role |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | <https://console.anthropic.com> |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` | literal value |
| `CRON_SECRET` | 40-char random string | `openssl rand -hex 32` on your laptop |
| `RESEND_API_KEY` | `re_...` | Only needed for email — can skip for now |
| `RESEND_FROM_EMAIL` | `pmo@jcorp.my` | Only needed for email |
| `RESEND_FROM_NAME` | `JCorp PMO Platform` | |
| `NEXT_PUBLIC_APP_URL` | `https://jcorp-pmo.azurewebsites.net` | your App Service URL |
| `NEXT_PUBLIC_APP_NAME` | `JCorp PMO` | |
| `WEBSITE_NODE_DEFAULT_VERSION` | `~20` | App Service runtime pin |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `false` | We build in GitHub Actions instead |

Click **Apply** at the top. Azure restarts the app automatically.

---

## Step 3 — Download the publish profile (2 min)

Web App overview page → toolbar at top → **Download publish profile** (or click **⋯ More → Get publish profile**).

You get a `.PublishSettings` XML file. Open it in a text editor — you'll paste the whole contents into GitHub next.

---

## Step 4 — Add GitHub secrets (5 min)

In your GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**.

Add these five secrets:

| Secret name | Value |
|---|---|
| `AZUREAPPSERVICE_PUBLISHPROFILE` | Paste the entire contents of the `.PublishSettings` file |
| `NEXT_PUBLIC_SUPABASE_URL` | Same as App Service config |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as App Service config |
| `NEXT_PUBLIC_APP_URL` | `https://jcorp-pmo.azurewebsites.net` |
| `APP_BASE_URL` | `https://jcorp-pmo.azurewebsites.net` (for the cron workflow) |
| `CRON_SECRET` | Same 40-char value as in App Service |

**Why the duplication** (App Service + GitHub): the `NEXT_PUBLIC_*` vars get baked into the Next.js client bundle at build time by GitHub Actions. `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` are only read at runtime in App Service — they don't need to be in GitHub.

---

## Step 5 — Update the App Service name in the workflow (1 min)

If you named the Web App something other than `jcorp-pmo`, edit `.github/workflows/deploy-azure.yml` → change `AZURE_WEBAPP_NAME` to your actual name → commit and push.

---

## Step 6 — Trigger the first deploy (5 min)

Two ways:

**A. Automatic on next push**
Make any change (even a whitespace edit in `README.md`), commit, push. GitHub Actions → Actions tab → you'll see **Deploy to Azure App Service** running.

**B. Manual**
GitHub → Actions tab → **Deploy to Azure App Service** → **Run workflow** → pick the `claude/digital-pmo-platform-rBHme` branch → **Run workflow**.

The workflow:
1. Installs deps
2. Builds Next.js (with your `NEXT_PUBLIC_*` vars baked in)
3. Prunes dev dependencies
4. Zips the app
5. Uploads the zip to App Service via publish profile

Watch the logs. A successful run takes ~3–5 minutes.

---

## Step 7 — Point Supabase auth redirects at the new URL (2 min)

Supabase → **Authentication → URL Configuration**:

- **Site URL**: `https://jcorp-pmo.azurewebsites.net`
- **Redirect URLs** (add these to the existing list):
  - `https://jcorp-pmo.azurewebsites.net/auth/callback`
  - Keep the Vercel + localhost entries for fallback/testing

Click **Save**.

---

## Step 8 — Smoke test (5 min)

1. Open `https://jcorp-pmo.azurewebsites.net` in a private/incognito window.
2. Expected: `/login` page. Not `/setup`, not a 500.
3. Enter your email → magic link → click from inbox → dashboard.
4. You should see IRIS in the project list and the Admin section in the sidebar.

### If the app shows "Application Error"

Azure Portal → Web App → **Log stream** (left sidebar). Refresh the site in another tab, watch the stream for the actual error.

Most common:
| Symptom | Fix |
|---|---|
| `Error: Cannot find module 'next'` | Build didn't include `node_modules`. Check the GitHub Actions zip step succeeded. |
| Page loads but shows `/setup` | Env vars scoped wrong in App Service. Re-check **Environment variables** all show up. |
| 500 on /login or /auth/callback | Supabase redirect URL doesn't include the Azure URL. Re-do Step 7. |
| "Application running but slow first load" | Normal for Basic B1. Upgrade to S1 to eliminate cold starts. |

---

## Step 9 — Switch cron from Vercel to GitHub Actions (2 min)

If you kept the Vercel project running, disable its crons so they don't fire twice:

- Vercel → your project → **Settings → Cron Jobs** → disable all.

The `.github/workflows/cron.yml` workflow now runs on Azure:
- Mon 09:00 MYT — submission reminders
- Tue 12:00 MYT — second reminder
- Tue 14:00 MYT — weekly report generation
- Tue 14:30 MYT — AI insight digest

You can also trigger them manually: GitHub → Actions → **Scheduled cron** → **Run workflow** → pick `reminders` / `reports` / `insights`.

---

## Step 10 — Custom domain (optional, do later)

Once you're ready to point `pmo.jcorp.my` at Azure:

1. Web App → **Settings → Custom domains → Add custom domain**.
2. Add `pmo.jcorp.my`. Azure shows a TXT + CNAME record — JCorp IT ticket to add both to DNS.
3. Once verified, Azure provisions a **free** managed SSL certificate for you.
4. Update `NEXT_PUBLIC_APP_URL`, Supabase Site URL, and GitHub secrets to the new domain.

---

## Costs (ballpark, monthly)

- App Service **Basic B1** Linux: ~MYR 60
- Azure egress at IRIS scale (~10 users, <10GB bandwidth): ~MYR 5
- Application Insights (first 5GB free): MYR 0
- Supabase Pro (optional when Free tier runs out): ~MYR 110
- Anthropic Claude (IRIS weekly reports, ~USD 2/month): ~MYR 10
- Resend (3,000 emails/month free): MYR 0
- **Total at IRIS scale:** ~MYR 70–180 depending on Supabase tier.

Scales roughly linearly with active projects. 100 projects ≈ MYR 400–600/month.

---

## Rolling back to Vercel

Everything is still there:
- `vercel.json` is unchanged
- Vercel env vars are still set
- Vercel deployments are still green

Just toggle DNS / share the Vercel URL again. No code rollback needed.

---

## Next up — Azure Postgres migration (future session)

When you're ready to move the database off Supabase too:
1. Provision Azure Database for PostgreSQL — Flexible Server (you already did this ✓)
2. `pg_dump` from Supabase → `psql` restore into Azure Postgres
3. Replace Supabase Auth with Entra ID via NextAuth.js (separate effort)
4. Replace Supabase Storage with Azure Blob Storage (separate effort)
5. Rewrite ~50 Supabase client calls to use Drizzle + postgres driver

I'll scope that properly when you have bandwidth — not a same-day job.
