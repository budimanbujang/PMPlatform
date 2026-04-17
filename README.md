# JCorp Digital PMO Platform

Source of truth for every project running in JCorp HoldCo. A generic project-reporting and governance engine, with Project IRIS as its first tenant.

**Deploying?** Follow [`DEPLOY.md`](./DEPLOY.md) — 90 minutes, end to end.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fbudimanbujang%2Fpmplatform&project-name=jcorp-pmo&repository-name=jcorp-pmo&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY,ANTHROPIC_API_KEY,RESEND_API_KEY,CRON_SECRET,NEXT_PUBLIC_APP_URL,NEXT_PUBLIC_APP_NAME&envDescription=See%20DEPLOY.md%20for%20each%20variable&envLink=https%3A%2F%2Fgithub.com%2Fbudimanbujang%2Fpmplatform%2Fblob%2Fmain%2FDEPLOY.md)

## What's in the box (Phase 0 → Phase 4 scaffold)

- **Project register** — create, configure, and manage projects and their initiatives.
- **Weekly submission loop** — 5-module form (Header, Progress, Risks, Documents, Narrative) with draft save, document uploads (≤10MB), and escalation flag.
- **Report pipeline** — structured JSON payload → Claude API → 6-section markdown → branded React-PDF → email delivery via Resend.
- **Governance modules** — deliverables with ownership/evidence, risks with auto-scored severity×likelihood, budget lines with planned/committed/actual rollup.
- **AI insights** — Claude-powered anomaly, pattern, and gap detection across the portfolio.
- **Dashboards** — personal home, portfolio RAG, budget rollup, search.
- **RLS everywhere** — multi-tenant from day one via `organisation_id` + Supabase Row-Level Security.
- **Cron** — Monday 09:00 reminders, Tuesday 12:00 deadline escalation, Tuesday 14:00 report run, Tuesday 14:30 insight digest.

## Quick start

```bash
# 1. Install
pnpm install            # or npm / yarn

# 2. Point at a Supabase project
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, keys, ANTHROPIC_API_KEY, etc.

# 3. Run migrations + seed
npx supabase link --project-ref <ref>
npx supabase db push
psql "$DATABASE_URL" -f supabase/seed/iris.sql
pnpm tsx scripts/seed-users.ts   # creates 12 placeholder IRIS users

# 4. Run dev server
pnpm dev
```

Open <http://localhost:3000>. First sign-in auto-creates a `profiles` row; attach it to the seeded org via Supabase studio or `scripts/seed-users.ts`.

## Running scheduled jobs

Vercel Cron definitions live in `vercel.json`. If you're not on Vercel, run manually:

```bash
pnpm cron:reminders   # POST /api/cron/reminders
pnpm cron:reports     # POST /api/cron/reports
```

Both endpoints require `Authorization: Bearer $CRON_SECRET`.

## Repository layout

```
supabase/
  migrations/   SQL migrations (Phase 0..4 split by file)
  seed/         IRIS seed data
src/
  app/(app)/    authenticated app shell + all pages
  app/api/      route handlers (cron, manual triggers)
  components/   shell, ui primitives
  lib/          supabase clients, auth, reports, ai, email, cron auth
  types/        hand-maintained DB types
scripts/        one-shot CLI scripts (user seed, cron runners)
tests/          Playwright e2e
```

## Architecture

```
┌───────── Executive dashboards ─────────┐
│ Portfolio RAG · Budget rollup · Insights│
├─────────────────────────────────────────┤
│ Claude insight engine + rule analytics  │  ← src/app/api/cron/insights
├─────────────────────────────────────────┤
│ Governance: RAG, escalations, audit     │
├─────────────────────────────────────────┤
│ Register: projects, initiatives,        │  ← src/app/(app)/projects/**
│ members, deliverables, risks, budget    │
├─────────────────────────────────────────┤
│ Reporting: form templates, submissions, │  ← src/app/(app)/projects/[id]/submit
│ documents, auto-report generation       │     src/lib/reports/*
├─────────────────────────────────────────┤
│ Identity: Supabase Auth + Google SSO    │  ← src/middleware.ts, /login
└─────────────────────────────────────────┘
```

## Phase status

| Phase | Scope | Status |
|------|-------|--------|
| 0 | IRIS reporting loop end-to-end | ✅ scaffolded |
| 1 | Project templates + wizard + lifecycle | ✅ wizard + lifecycle events; template editor Phase 1.1 |
| 2 | Portfolio, budget, deliverables, risks | ✅ |
| 3 | AI insight engine, search, gap detection | ✅ anomaly/pattern digest + full-text search |
| 4 | Integrations, audit log, SSO hardening | 🟡 schema + stubs |

## What still needs human work

- Provisioning: Supabase project, Google OAuth client, Resend domain, Vercel project.
- The decision points in `PROJECT_CONTEXT.md` §13 (domain, data residency, branding).
- Group IT security review before production go-live.
