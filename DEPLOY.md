# Deploying JCorp PMO Platform to Vercel

End-to-end, click-by-click. Expect ~90 minutes the first time.

Prerequisites: a laptop with Node 20+ and `pnpm` (or `npm`), and the ability to sign up for: Supabase, Google Cloud, Anthropic, Resend, Vercel. If any of these are blocked by JCorp IT, flag them now — they have lead times.

---

## Step 1 — Fork & clone (2 min)

```bash
git clone https://github.com/budimanbujang/pmplatform.git
cd pmplatform
git checkout claude/digital-pmo-platform-rBHme
pnpm install
cp .env.example .env.local
```

Leave `.env.local` blank for now; we'll fill it as we go.

---

## Step 2 — Supabase project (15 min)

1. Go to <https://supabase.com/dashboard> → **New project**.
2. Name: `jcorp-pmo`. Region: **Southeast Asia (Singapore) `ap-southeast-1`** — closest to Johor with acceptable latency.
3. Set a strong database password and save it somewhere you trust.
4. Wait ~2 minutes for provisioning.
5. **Project Settings → API** — copy these into `.env.local`:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (keep secret)
6. **Project Settings → Database → Connection string → URI** — copy into `.env.local` as `DATABASE_URL`. Replace the password placeholder with your actual DB password.

### Apply migrations + seed

```bash
npm i -g supabase              # Supabase CLI
supabase link --project-ref <your-project-ref>
supabase db push               # applies all 6 migration files
psql "$DATABASE_URL" -f supabase/seed/iris.sql
```

You should now see `organisations`, `projects`, `project-documents` bucket, etc. in Supabase Studio.

> If `supabase db push` prompts about a remote schema diff, answer **yes** to push the local migrations — they are the source of truth.

---

## Step 3 — Google SSO (20 min)

1. <https://console.cloud.google.com> → create project `jcorp-pmo` (or pick an existing JCorp project).
2. **APIs & Services → OAuth consent screen**:
   - User type: **Internal** (restricts to `@jcorp.my`).
   - App name: `JCorp PMO`.
   - Authorized domain: `jcorp.my`.
3. **APIs & Services → Credentials → Create OAuth client ID → Web application**:
   - Name: `JCorp PMO — Supabase`.
   - Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
4. Copy the client ID + secret.
5. In Supabase: **Authentication → Providers → Google** → enable, paste client ID/secret, save.
6. **Authentication → URL Configuration**:
   - Site URL: `https://<your-vercel-url>` (you'll update this after Step 7).
   - Redirect URLs: add `https://<your-vercel-url>/auth/callback` and `http://localhost:3000/auth/callback`.

> For the dev phase you can skip Google and use magic links; the login page offers both.

---

## Step 4 — Anthropic Claude API (5 min)

1. <https://console.anthropic.com> → create a workspace `jcorp-pmo`.
2. Add a payment method. Budget alerts at USD 100 / 500 / 1000.
3. **API Keys → Create Key** → name `pmplatform-prod` → copy into `.env.local` as `ANTHROPIC_API_KEY`.
4. Leave `ANTHROPIC_MODEL=claude-sonnet-4-6` (the default).

Expected cost at 8 IRIS initiatives × 1 weekly report × Sonnet 4.6: **~USD 0.30/week**. Scales roughly linearly per project.

---

## Step 5 — Resend (email) (15 min, includes DNS lead time)

1. <https://resend.com> → sign up with your JCorp email.
2. **Domains → Add** → `jcorp.my` (or a subdomain like `pmo.jcorp.my`).
3. Resend shows DKIM, SPF, and return-path records. **Paste those into your JCorp DNS.**
   - If JCorp IT owns DNS: file a ticket with the exact records; expect 1–2 working days.
   - For the dev phase, use the shared `onboarding@resend.dev` sandbox — emails only deliver to your verified address.
4. Once the domain status shows `Verified`, go to **API Keys → Create** → paste into `.env.local` as `RESEND_API_KEY`.
5. Set `RESEND_FROM_EMAIL=pmo@jcorp.my` and `RESEND_FROM_NAME="JCorp PMO Platform"`.

---

## Step 6 — Generate secrets (1 min)

```bash
# macOS / Linux:
openssl rand -hex 32     # -> CRON_SECRET
```

Add to `.env.local`:

```bash
CRON_SECRET=<paste>
NEXT_PUBLIC_APP_URL=http://localhost:3000     # update after Step 7
NEXT_PUBLIC_APP_NAME="JCorp PMO"
```

Sanity-check locally before deploying:

```bash
pnpm dev
# visit http://localhost:3000 — should redirect to /login
pnpm preflight                                 # exits 0 if all checks pass
```

---

## Step 7 — Deploy to Vercel (10 min)

1. Push your repo to GitHub under your JCorp org if you haven't already.
2. <https://vercel.com/new> → import the repo.
3. **Framework: Next.js** is auto-detected. Leave build/install commands default.
4. **Environment variables** — copy every line from `.env.local`:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | from Step 2 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Step 2 |
   | `SUPABASE_SERVICE_ROLE_KEY` | from Step 2 (mark as **Secret**) |
   | `ANTHROPIC_API_KEY` | from Step 4 (**Secret**) |
   | `ANTHROPIC_MODEL` | `claude-sonnet-4-6` |
   | `RESEND_API_KEY` | from Step 5 (**Secret**) |
   | `RESEND_FROM_EMAIL` | `pmo@jcorp.my` |
   | `RESEND_FROM_NAME` | `JCorp PMO Platform` |
   | `CRON_SECRET` | from Step 6 (**Secret**) |
   | `NEXT_PUBLIC_APP_URL` | leave blank, we update after first deploy |
   | `NEXT_PUBLIC_APP_NAME` | `JCorp PMO` |
   | `DATABASE_URL` | only needed locally; skip here |

5. **Deploy**. First build takes ~3 minutes.
6. Once you have the production URL (e.g. `https://jcorp-pmo.vercel.app`):
   - Update `NEXT_PUBLIC_APP_URL` in Vercel → redeploy.
   - Add the URL + `/auth/callback` to Supabase **Auth → URL Configuration**.
   - Add the URL + `/auth/callback` to Google OAuth redirect URIs.

7. Vercel reads `vercel.json` and provisions 4 cron jobs automatically — see **Cron Jobs** in the Vercel dashboard.

### Custom domain (optional, can defer)

**Settings → Domains → Add** → `pmo.jcorp.my`. Vercel shows a CNAME; add it via JCorp DNS. Update Supabase + Google redirects once live.

---

## Step 8 — Bootstrap your admin account (5 min)

1. Visit the live URL → **Continue with JCorp Google**.
2. Your profile row gets created automatically. The `handle_new_user` trigger attaches you to the JCorp org because the email domain matches.
3. Locally, mark yourself as platform admin:

   ```bash
   pnpm bootstrap-admin --email you@jcorp.my
   ```

4. Refresh the browser. The Admin section appears in the sidebar.

---

## Step 9 — Seed the IRIS Champions (10 min)

Edit `scripts/seed-users.ts` — replace the placeholder names/emails with the actual 20 IRIS users. Then:

```bash
pnpm seed-users
```

This creates Supabase Auth accounts and adds them to Project IRIS with the correct roles. They log in via Google; first login creates their profile (already attached to JCorp by the domain trigger) and triggers membership by email.

---

## Step 10 — Smoke test the weekly loop (20 min)

1. Have one Champion sign in and submit an update for their initiative.
2. Verify the document upload worked (Supabase Studio → Storage → `project-documents`).
3. As TMO, open **/projects/\<iris-id\>/reports** → click **Generate for this week**. Wait ~30 seconds for Claude + PDF.
4. Download the PDF; it should have 6 sections filled with real submission data.
5. Toggle the `escalate` checkbox on a submission → confirm an alert row appears in **alerts** table.
6. Kick the cron manually to prove wiring:

   ```bash
   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
        https://<vercel-url>/api/cron/reminders
   ```

---

## Step 11 — Observability (10 min)

- **Vercel → Logs**: tail while running a report.
- **Supabase → Logs**: DB errors, RLS denials.
- **Resend → Logs**: delivery/bounce/open.
- Recommended: add Axiom or Better Stack for long-term log retention.

---

## Ongoing

- Weekly: watch `report_runs.ai_input_tokens`/`ai_output_tokens` for cost anomalies.
- Monthly: re-generate Supabase types: `supabase gen types typescript --linked > src/types/database.ts`.
- Each new project: created via UI **/projects/new** — no code changes.

---

## Rollback

Vercel: **Deployments → pick last-known-good → Promote**. Supabase migrations are append-only in this scaffold; a manual rollback migration file is safer than `supabase db reset` against production.

---

## Troubleshooting first-deploy issues

| Symptom | Fix |
|---|---|
| Every page redirects to `/setup` | Env vars not set in Vercel. Open /setup to see which one. |
| Login loops back to `/login` | Google redirect URI on Supabase doesn't match the live URL. |
| PDF generation times out | `maxDuration: 300` is set in `vercel.json`. If you're on Vercel Hobby, upgrade to Pro for 300s — Hobby is capped at 60s. |
| `supabase db push` says "no migrations to apply" | You're already up to date. Run `supabase db reset --linked` carefully only in dev. |
| Emails go to spam | DKIM/SPF not propagated yet. Wait 30 min, then use Resend's **Insights** tab to verify. |
| `pnpm preflight` — claude check fails | Check the API key is active in Anthropic console; free-tier orgs are rate-limited. |
