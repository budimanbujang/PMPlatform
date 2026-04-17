# PROJECT_CONTEXT.md — JCorp Digital PMO Platform

Loaded at the start of every Claude Code session. Update it when architecture or conventions change.

## 1. What this codebase is

A Next.js 14 (App Router) + Supabase platform that acts as the source of truth for every project running in JCorp HoldCo. Phase 0 launches with Project IRIS (8 initiatives, 20 users). The platform is multi-tenant from day one.

## 2. Stack and why

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 14 App Router + React Server Components |
| Styling | Tailwind CSS (no component library — custom primitives in `src/components/ui`) |
| Backend | Supabase (Postgres + Auth + Storage) |
| Auth | Supabase Auth with Google SSO (`hd=jcorp.my`) + magic link fallback |
| AI | `@anthropic-ai/sdk` against `claude-sonnet-4-6` |
| PDF | `@react-pdf/renderer` rendered in the Node runtime |
| Email | Resend |
| Hosting | Vercel (frontend + API routes + cron) |
| Types | Hand-maintained in `src/types/database.ts`, regenerate with `supabase gen types` |

Do **not** introduce: a component library (shadcn etc.), Prisma, Drizzle, tRPC, or a separate backend framework — the app stays server-component-first with Supabase client calls.

## 3. Data model principles

- Every tenant-owned row has `organisation_id`, enforced by RLS.
- Every table has `created_at`, `updated_at` (via `tg_set_updated_at` trigger) unless it's an append-only log.
- Enums for anything bounded (RAG, status, severity).
- One submission row per `(initiative_id, period_start)`. Never duplicate.
- Documents are stored in the `project-documents` bucket; reports in the `reports` bucket.
- Budget flows: `budget_lines` (planned/committed) → `budget_actuals` (time-stamped). The view `v_project_budget_summary` is the rollup.

## 4. RLS conventions

- `public.current_org_id()` returns the caller's `profiles.organisation_id`.
- `public.is_project_member(project_id)` / `has_project_role(project_id, roles[])` drive project-scoped reads and writes.
- `is_platform_admin()` is the break-glass.
- Helper functions are `SECURITY DEFINER` to avoid recursion through `members`.

## 5. Routing conventions

- Authenticated pages live under `src/app/(app)/` — the group layout fetches the profile and renders the shell.
- `src/middleware.ts` redirects unauthenticated users to `/login`.
- Admin pages guard with `profile.is_platform_admin`.
- API routes live under `src/app/api/`. Cron routes check `Authorization: Bearer $CRON_SECRET` via `src/lib/cron/auth.ts`.

## 6. Server actions

- Actions live next to the page that uses them, named `actions.ts`.
- Always validate with `zod` at the boundary.
- Always call `requireProfile()` first — it redirects if the user is missing.

## 7. The weekly loop (IRIS)

1. **Mon 09:00** — `/api/cron/reminders` emails Champions whose submissions are outstanding.
2. **Mon 15:00** — Champion submission deadline.
3. **Tue 12:00** — A second reminder fires for anything still in draft (same reminder route).
4. **Tue 14:00** — `/api/cron/reports` compiles, calls Claude, renders PDF, uploads to `reports` bucket, emails TMO + IWC + sponsor/executive roles.
5. **Tue 14:30** — `/api/cron/insights` runs Claude once per organisation to produce the weekly digest.

## 8. Never break IRIS

- End-to-end Playwright test in `tests/e2e/weekly-loop.spec.ts` validates: Champion can submit → TMO can generate a report → escalation alerts fire.
- Any migration or model change that touches `submissions`, `projects`, `initiatives`, `report_runs`, or `documents` must also update the seed file and the Playwright fixtures.

## 9. File size & style

- Keep React server components lean — no client state, fetch via Supabase server client.
- Push interactivity to `"use client"` components named with a descriptor (e.g. `submission-form.tsx`, `generate-button.tsx`).
- Tailwind classes in order: layout → box → typography → colour → state. Use `cn()` for conditional classes.
- No emojis in code or UI unless explicitly requested.
- TypeScript strict; no `any` except at JSON boundaries where it's unavoidable.

## 10. Phases (see ROADMAP.md / build plan)

Phase 0 (Days 1–7): IRIS weekly loop.
Phase 1: generalisation (templates, wizard, lifecycle).
Phase 2: portfolios, budget, deliverables, risks.
Phase 3: AI insights, gap detection, search.
Phase 4: integrations, audit, SSO hardening.
Phase 5: copilot, scenario modelling, external portal.

## 11. Still-unresolved decisions

These block or colour implementation — confirm before committing downstream work:

- Final domain (`pmo.jcorp.my`?) and therefore SSO redirect URIs.
- Supabase region (Singapore `ap-southeast-1` assumed; verify with JCorp IT).
- Whether the 8 IRIS initiative codes are permanent or get replaced by templated codes in Phase 1.
- Who owns the Claude API / Supabase Pro / Resend / Vercel bill (~USD 300–600/month at 100 projects).
- Whether Group IT needs sign-off before `prod` vs in parallel.

## 12. Golden rule

Build a **generic reporting and governance engine**, then configure IRIS as its first instance. Every time you're tempted to hardcode an IRIS-specific rule, put it in a template or a config instead.
