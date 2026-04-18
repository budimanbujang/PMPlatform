// =============================================================================
// Drizzle schema — mirrors the Supabase migrations but drops RLS, auth.users
// coupling, and the handle_new_user trigger. Authorization moves to the app
// layer (see src/lib/auth/authz.ts). Apply via `pnpm db:push`.
// =============================================================================

import {
  pgTable, pgEnum, pgView,
  uuid, text, boolean, integer, smallint, timestamp, date, time,
  jsonb, numeric, bigserial, inet, pgSchema,
  unique, index, check,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------
export const projectStatus    = pgEnum("project_status",    ["draft","active","on_hold","closed","archived"]);
export const projectRag       = pgEnum("project_rag",       ["green","amber","red","grey"]);
export const memberRole       = pgEnum("member_role",       ["sponsor","executive","pmo","tmo","iwc","champion","io","delivery_lead","finance_controller","steering","viewer"]);
export const documentTag      = pgEnum("document_tag",      ["evidence","deliverable","reference","other"]);
export const submissionStatus = pgEnum("submission_status", ["draft","submitted","late","missed","void"]);
export const reportStatus     = pgEnum("report_status",     ["queued","generating","succeeded","failed"]);
export const formFieldType    = pgEnum("form_field_type",   ["rag","number","currency","short_text","long_text","date","file","toggle","dropdown","multi_select","user_picker"]);
export const budgetCategory   = pgEnum("budget_category",   ["capex","opex","vendor","licensing","people","contingency","other"]);
export const deliverableStatus= pgEnum("deliverable_status",["not_started","in_progress","blocked","complete","cancelled"]);
export const riskSeverity     = pgEnum("risk_severity",     ["low","medium","high","critical"]);
export const riskLikelihood   = pgEnum("risk_likelihood",   ["rare","unlikely","possible","likely","almost_certain"]);
export const riskStatusEnum   = pgEnum("risk_status",       ["open","mitigating","closed","accepted"]);
export const insightKind      = pgEnum("insight_kind",      ["weekly_digest","anomaly","pattern","compliance_gap","reporting_gap","resource_gap","dependency_gap","predictive"]);
export const insightSeverity  = pgEnum("insight_severity",  ["info","notice","warn","critical"]);

// Commonly-reused timestamp columns
const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// -----------------------------------------------------------------------------
// organisations
// -----------------------------------------------------------------------------
export const organisations = pgTable("organisations", {
  id:           uuid("id").primaryKey().defaultRandom(),
  slug:         text("slug").notNull().unique(),
  name:         text("name").notNull(),
  brandPrimary: text("brand_primary").default("#b87d07"),
  brandLogo:    text("brand_logo"),
  domain:       text("domain"),
  region:       text("region").default("ap-southeast-1"),
  createdAt, updatedAt,
});

// -----------------------------------------------------------------------------
// profiles — user row. Keyed by the NextAuth session user id (uuid), which
// we mint when the user first signs in via Entra. Email is the join key to
// the `auth.users` row in Supabase during the data migration.
// -----------------------------------------------------------------------------
export const profiles = pgTable("profiles", {
  id:              uuid("id").primaryKey().defaultRandom(),
  organisationId:  uuid("organisation_id").references(() => organisations.id, { onDelete: "set null" }),
  email:           text("email").notNull().unique(),
  fullName:        text("full_name"),
  avatarUrl:       text("avatar_url"),
  jobTitle:        text("job_title"),
  department:      text("department"),
  isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
  // entra_oid stores the Microsoft Entra ID objectId — lets us correlate
  // the session user with the profile row on every request without hitting
  // the DB by email every time.
  entraOid:        text("entra_oid").unique(),
  createdAt, updatedAt,
});

// -----------------------------------------------------------------------------
// submission_templates  (forward-declared; FK from projects)
// -----------------------------------------------------------------------------
export const submissionTemplates = pgTable("submission_templates", {
  id:             uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  name:           text("name").notNull(),
  description:    text("description"),
  modules:        jsonb("modules").notNull().default(sql`'[]'::jsonb`),
  isDefault:      boolean("is_default").notNull().default(false),
  createdAt, updatedAt,
});

// -----------------------------------------------------------------------------
// portfolios & programmes (forward FK from projects)
// -----------------------------------------------------------------------------
export const portfolios = pgTable("portfolios", {
  id:             uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  code:           text("code").notNull(),
  name:           text("name").notNull(),
  description:    text("description"),
  sponsorId:      uuid("sponsor_id").references(() => profiles.id),
  createdAt, updatedAt,
}, (t) => ({
  uniqOrgCode: unique().on(t.organisationId, t.code),
}));

export const programmes = pgTable("programmes", {
  id:             uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  portfolioId:    uuid("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }),
  code:           text("code").notNull(),
  name:           text("name").notNull(),
  description:    text("description"),
  createdAt, updatedAt,
}, (t) => ({
  uniqOrgCode: unique().on(t.organisationId, t.code),
}));

// -----------------------------------------------------------------------------
// projects
// -----------------------------------------------------------------------------
export const projects = pgTable("projects", {
  id:              uuid("id").primaryKey().defaultRandom(),
  organisationId:  uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  code:            text("code").notNull(),
  name:            text("name").notNull(),
  description:     text("description"),
  department:      text("department"),
  sponsorId:       uuid("sponsor_id").references(() => profiles.id),
  status:          projectStatus("status").notNull().default("draft"),
  rag:             projectRag("rag").notNull().default("grey"),
  cadence:         text("cadence").notNull().default("weekly"),
  submissionDeadlineDow:  smallint("submission_deadline_dow").default(1),
  submissionDeadlineTime: time("submission_deadline_time").default("15:00"),
  reportDayDow:    smallint("report_day_dow").default(2),
  reportTime:      time("report_time").default("14:00"),
  templateId:      uuid("template_id").references(() => submissionTemplates.id, { onDelete: "set null" }),
  programmeId:     uuid("programme_id").references(() => programmes.id, { onDelete: "set null" }),
  portfolioId:     uuid("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }),
  startDate:       date("start_date"),
  targetEndDate:   date("target_end_date"),
  closedAt:        timestamp("closed_at", { withTimezone: true }),
  createdBy:       uuid("created_by").references(() => profiles.id),
  createdAt, updatedAt,
}, (t) => ({
  uniqOrgCode: unique().on(t.organisationId, t.code),
  idxOrg:      index("idx_projects_org").on(t.organisationId),
  idxStatus:   index("idx_projects_status").on(t.status),
}));

// -----------------------------------------------------------------------------
// initiatives
// -----------------------------------------------------------------------------
export const initiatives = pgTable("initiatives", {
  id:             uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  projectId:      uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  code:           text("code").notNull(),
  name:           text("name").notNull(),
  description:    text("description"),
  championId:     uuid("champion_id").references(() => profiles.id),
  ioId:           uuid("io_id").references(() => profiles.id),
  rag:            projectRag("rag").notNull().default("grey"),
  sortOrder:      integer("sort_order").notNull().default(0),
  createdAt, updatedAt,
}, (t) => ({
  uniqProjectCode: unique().on(t.projectId, t.code),
  idxProject:      index("idx_initiatives_project").on(t.projectId),
}));

// -----------------------------------------------------------------------------
// members
// -----------------------------------------------------------------------------
export const members = pgTable("members", {
  id:             uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  projectId:      uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  profileId:      uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  role:           memberRole("role").notNull(),
  initiativeId:   uuid("initiative_id").references(() => initiatives.id, { onDelete: "set null" }),
  isActive:       boolean("is_active").notNull().default(true),
  createdAt, updatedAt,
}, (t) => ({
  uniq:       unique().on(t.projectId, t.profileId, t.role, t.initiativeId),
  idxProject: index("idx_members_project").on(t.projectId),
  idxProfile: index("idx_members_profile").on(t.profileId),
}));

// -----------------------------------------------------------------------------
// submissions
// -----------------------------------------------------------------------------
export const submissions = pgTable("submissions", {
  id:              uuid("id").primaryKey().defaultRandom(),
  organisationId:  uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  projectId:       uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  initiativeId:    uuid("initiative_id").references(() => initiatives.id, { onDelete: "cascade" }),
  periodStart:     date("period_start").notNull(),
  periodEnd:       date("period_end").notNull(),
  dueAt:           timestamp("due_at", { withTimezone: true }).notNull(),
  submittedAt:     timestamp("submitted_at", { withTimezone: true }),
  submittedBy:     uuid("submitted_by").references(() => profiles.id),
  status:          submissionStatus("status").notNull().default("draft"),
  rag:             projectRag("rag").notNull().default("grey"),
  progressPct:     smallint("progress_pct"),
  headline:        text("headline"),
  progressNotes:   text("progress_notes"),
  risksText:       text("risks_text"),
  issuesText:      text("issues_text"),
  narrative:       text("narrative"),
  escalate:        boolean("escalate").notNull().default(false),
  escalateReason:  text("escalate_reason"),
  payload:         jsonb("payload").notNull().default(sql`'{}'::jsonb`),
  createdAt, updatedAt,
}, (t) => ({
  uniqInitPeriod: unique().on(t.initiativeId, t.periodStart),
  idxProjectPeriod: index("idx_submissions_project_period").on(t.projectId, t.periodStart),
  idxStatus: index("idx_submissions_status").on(t.status),
}));

// -----------------------------------------------------------------------------
// deliverables + milestones
// -----------------------------------------------------------------------------
export const milestones = pgTable("milestones", {
  id:             uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  projectId:      uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name:           text("name").notNull(),
  targetDate:     date("target_date").notNull(),
  dayMarker:      smallint("day_marker"),
  status:         deliverableStatus("status").notNull().default("not_started"),
  completedAt:    timestamp("completed_at", { withTimezone: true }),
  createdAt, updatedAt,
}, (t) => ({
  idxProject: index("idx_milestones_project").on(t.projectId, t.targetDate),
}));

export const deliverables = pgTable("deliverables", {
  id:                 uuid("id").primaryKey().defaultRandom(),
  organisationId:     uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  projectId:          uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  initiativeId:       uuid("initiative_id").references(() => initiatives.id, { onDelete: "set null" }),
  milestoneId:        uuid("milestone_id").references(() => milestones.id, { onDelete: "set null" }),
  title:              text("title").notNull(),
  description:        text("description"),
  acceptanceCriteria: text("acceptance_criteria"),
  ownerId:            uuid("owner_id").references(() => profiles.id),
  dueDate:            date("due_date"),
  status:             deliverableStatus("status").notNull().default("not_started"),
  completedAt:        timestamp("completed_at", { withTimezone: true }),
  evidenceDocumentId: uuid("evidence_document_id"),  // FK patched below
  createdAt, updatedAt,
}, (t) => ({
  idxProject: index("idx_deliv_project").on(t.projectId),
  idxOwner:   index("idx_deliv_owner").on(t.ownerId),
  idxDue:     index("idx_deliv_due").on(t.dueDate),
}));

// -----------------------------------------------------------------------------
// documents
// -----------------------------------------------------------------------------
export const documents = pgTable("documents", {
  id:             uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  projectId:      uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  initiativeId:   uuid("initiative_id").references(() => initiatives.id, { onDelete: "set null" }),
  submissionId:   uuid("submission_id").references(() => submissions.id, { onDelete: "cascade" }),
  deliverableId:  uuid("deliverable_id").references((): AnyPgColumn => deliverables.id, { onDelete: "set null" }),
  storagePath:    text("storage_path").notNull(),
  fileName:       text("file_name").notNull(),
  mimeType:       text("mime_type"),
  sizeBytes:      integer("size_bytes"),
  tag:            documentTag("tag").notNull().default("other"),
  description:    text("description"),
  uploadedBy:     uuid("uploaded_by").references(() => profiles.id),
  createdAt,
}, (t) => ({
  idxProject:    index("idx_documents_project").on(t.projectId),
  idxSubmission: index("idx_documents_submission").on(t.submissionId),
}));

// -----------------------------------------------------------------------------
// report_runs
// -----------------------------------------------------------------------------
export const reportRuns = pgTable("report_runs", {
  id:             uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  projectId:      uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  periodStart:    date("period_start").notNull(),
  periodEnd:      date("period_end").notNull(),
  status:         reportStatus("status").notNull().default("queued"),
  narrativeMd:    text("narrative_md"),
  pdfPath:        text("pdf_path"),
  inputPayload:   jsonb("input_payload"),
  errorMessage:   text("error_message"),
  aiModel:        text("ai_model"),
  aiInputTokens:  integer("ai_input_tokens"),
  aiOutputTokens: integer("ai_output_tokens"),
  aiLatencyMs:    integer("ai_latency_ms"),
  createdAt,
  completedAt:    timestamp("completed_at", { withTimezone: true }),
}, (t) => ({
  uniq: unique().on(t.projectId, t.periodStart),
}));

// -----------------------------------------------------------------------------
// budget
// -----------------------------------------------------------------------------
export const budgetLines = pgTable("budget_lines", {
  id:              uuid("id").primaryKey().defaultRandom(),
  organisationId:  uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  projectId:       uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  initiativeId:    uuid("initiative_id").references(() => initiatives.id, { onDelete: "set null" }),
  year:            integer("year").notNull(),
  quarter:         smallint("quarter"),
  category:        budgetCategory("category").notNull().default("other"),
  description:     text("description").notNull(),
  currency:        text("currency").notNull().default("MYR"),
  plannedAmount:   numeric("planned_amount", { precision: 18, scale: 2 }).notNull().default("0"),
  committedAmount: numeric("committed_amount", { precision: 18, scale: 2 }).notNull().default("0"),
  createdAt, updatedAt,
}, (t) => ({
  idxProject: index("idx_budget_project").on(t.projectId, t.year),
}));

export const budgetActuals = pgTable("budget_actuals", {
  id:            uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  budgetLineId: uuid("budget_line_id").notNull().references(() => budgetLines.id, { onDelete: "cascade" }),
  periodEnd:    date("period_end").notNull(),
  actualAmount: numeric("actual_amount", { precision: 18, scale: 2 }).notNull(),
  source:       text("source").default("manual"),
  reference:    text("reference"),
  recordedBy:   uuid("recorded_by").references(() => profiles.id),
  createdAt,
}, (t) => ({
  idxLine: index("idx_actuals_line").on(t.budgetLineId, t.periodEnd),
}));

// -----------------------------------------------------------------------------
// risks + issues
// -----------------------------------------------------------------------------
export const risks = pgTable("risks", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  organisationId:       uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  projectId:            uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  initiativeId:         uuid("initiative_id").references(() => initiatives.id, { onDelete: "set null" }),
  title:                text("title").notNull(),
  description:          text("description"),
  severity:             riskSeverity("severity").notNull().default("medium"),
  likelihood:           riskLikelihood("likelihood").notNull().default("possible"),
  score:                smallint("score"),
  status:               riskStatusEnum("status").notNull().default("open"),
  mitigation:           text("mitigation"),
  ownerId:              uuid("owner_id").references(() => profiles.id),
  nextReviewAt:         date("next_review_at"),
  relatedDeliverableId: uuid("related_deliverable_id").references(() => deliverables.id, { onDelete: "set null" }),
  relatedBudgetLineId:  uuid("related_budget_line_id").references(() => budgetLines.id, { onDelete: "set null" }),
  createdAt, updatedAt,
}, (t) => ({
  idxProject: index("idx_risks_project").on(t.projectId),
}));

export const riskReviewLog = pgTable("risk_review_log", {
  id:         uuid("id").primaryKey().defaultRandom(),
  riskId:     uuid("risk_id").notNull().references(() => risks.id, { onDelete: "cascade" }),
  actorId:    uuid("actor_id").references(() => profiles.id),
  notes:      text("notes"),
  fromStatus: riskStatusEnum("from_status"),
  toStatus:   riskStatusEnum("to_status"),
  createdAt,
});

export const issues = pgTable("issues", {
  id:             uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  projectId:      uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  initiativeId:   uuid("initiative_id").references(() => initiatives.id, { onDelete: "set null" }),
  title:          text("title").notNull(),
  description:    text("description"),
  severity:       riskSeverity("severity").notNull().default("medium"),
  status:         text("status").notNull().default("open"),
  ownerId:        uuid("owner_id").references(() => profiles.id),
  resolvedAt:     timestamp("resolved_at", { withTimezone: true }),
  createdAt, updatedAt,
});

// -----------------------------------------------------------------------------
// phase 1 — templates / cadence / lifecycle
// -----------------------------------------------------------------------------
export const projectTemplates = pgTable("project_templates", {
  id:               uuid("id").primaryKey().defaultRandom(),
  organisationId:   uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  kind:             text("kind").notNull(),
  name:             text("name").notNull(),
  description:      text("description"),
  defaultCadence:   text("default_cadence").notNull().default("weekly"),
  defaultRagRules:  jsonb("default_rag_rules").notNull().default(sql`'{}'::jsonb`),
  formTemplateId:   uuid("form_template_id").references(() => submissionTemplates.id),
  isActive:         boolean("is_active").notNull().default(true),
  createdAt, updatedAt,
});

export const formFields = pgTable("form_fields", {
  id:            uuid("id").primaryKey().defaultRandom(),
  templateId:    uuid("template_id").notNull().references(() => submissionTemplates.id, { onDelete: "cascade" }),
  moduleKey:     text("module_key").notNull(),
  fieldKey:      text("field_key").notNull(),
  label:         text("label").notNull(),
  helpText:      text("help_text"),
  fieldType:     formFieldType("field_type").notNull(),
  required:      boolean("required").notNull().default(false),
  visibleRoles:  memberRole("visible_roles").array(),
  options:       jsonb("options"),
  sortOrder:     integer("sort_order").notNull().default(0),
  createdAt,
}, (t) => ({
  uniqField: unique().on(t.templateId, t.fieldKey),
}));

export const cadenceSchedules = pgTable("cadence_schedules", {
  id:                uuid("id").primaryKey().defaultRandom(),
  projectId:         uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  role:              memberRole("role").notNull(),
  deadlineDow:       smallint("deadline_dow").notNull(),
  deadlineTime:      time("deadline_time").notNull(),
  reminderLeadHours: integer("reminder_lead_hours").notNull().default(24),
}, (t) => ({
  uniq: unique().on(t.projectId, t.role),
}));

export const projectLifecycleEvents = pgTable("project_lifecycle_events", {
  id:          uuid("id").primaryKey().defaultRandom(),
  projectId:   uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  fromStatus:  projectStatus("from_status"),
  toStatus:    projectStatus("to_status").notNull(),
  reason:      text("reason"),
  actorId:     uuid("actor_id").references(() => profiles.id),
  createdAt,
}, (t) => ({
  idxProject: index("idx_lifecycle_project").on(t.projectId, t.createdAt),
}));

// -----------------------------------------------------------------------------
// phase 3 — insights / search / alerts
// -----------------------------------------------------------------------------
export const aiInsights = pgTable("ai_insights", {
  id:              uuid("id").primaryKey().defaultRandom(),
  organisationId:  uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  scope:           text("scope").notNull(),
  scopeId:         uuid("scope_id"),
  kind:            insightKind("kind").notNull(),
  severity:        insightSeverity("severity").notNull().default("info"),
  headline:        text("headline").notNull(),
  bodyMd:          text("body_md"),
  supportingData:  jsonb("supporting_data"),
  generatedAt:     timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  acknowledgedAt:  timestamp("acknowledged_at", { withTimezone: true }),
  acknowledgedBy:  uuid("acknowledged_by").references(() => profiles.id),
  expiresAt:       timestamp("expires_at", { withTimezone: true }),
}, (t) => ({
  idxScope: index("idx_ai_insights_scope").on(t.scope, t.scopeId, t.generatedAt),
}));

export const insightSubscriptions = pgTable("insight_subscriptions", {
  id:             uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  profileId:      uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  scope:          text("scope").notNull(),
  scopeId:        uuid("scope_id"),
  channels:       text("channels").array().notNull().default(sql`ARRAY['email']::text[]`),
  cadence:        text("cadence").notNull().default("weekly"),
}, (t) => ({
  uniq: unique().on(t.profileId, t.scope, t.scopeId),
}));

export const alerts = pgTable("alerts", {
  id:             uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  projectId:      uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  kind:           text("kind").notNull(),
  severity:       insightSeverity("severity").notNull().default("notice"),
  title:          text("title").notNull(),
  body:           text("body"),
  firedAt:        timestamp("fired_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt:     timestamp("resolved_at", { withTimezone: true }),
}, (t) => ({
  idxProject: index("idx_alerts_project").on(t.projectId, t.firedAt),
}));

export const attentionListSnapshots = pgTable("attention_list_snapshots", {
  id:             uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  generatedAt:    timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  items:          jsonb("items").notNull(),
});

export const searchIndex = pgTable("search_index", {
  id:             uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  projectId:      uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  entityType:     text("entity_type").notNull(),
  entityId:       uuid("entity_id").notNull(),
  title:          text("title").notNull(),
  body:           text("body"),
  urlPath:        text("url_path"),
  // tsv is populated by a trigger — Drizzle doesn't model tsvector.
  createdAt,
}, (t) => ({
  idxProject: index("idx_search_project").on(t.projectId),
}));

// -----------------------------------------------------------------------------
// phase 4 — integrations / audit
// -----------------------------------------------------------------------------
export const integrations = pgTable("integrations", {
  id:             uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  kind:           text("kind").notNull(),
  name:           text("name").notNull(),
  config:         jsonb("config").notNull().default(sql`'{}'::jsonb`),
  secretRef:      text("secret_ref"),
  isActive:       boolean("is_active").notNull().default(false),
  lastSyncedAt:   timestamp("last_synced_at", { withTimezone: true }),
  createdAt, updatedAt,
});

export const integrationMappings = pgTable("integration_mappings", {
  id:             uuid("id").primaryKey().defaultRandom(),
  integrationId:  uuid("integration_id").notNull().references(() => integrations.id, { onDelete: "cascade" }),
  localEntity:    text("local_entity").notNull(),
  localId:        uuid("local_id").notNull(),
  remoteEntity:   text("remote_entity").notNull(),
  remoteId:       text("remote_id").notNull(),
  lastSyncedAt:   timestamp("last_synced_at", { withTimezone: true }),
}, (t) => ({
  uniq: unique().on(t.integrationId, t.localEntity, t.localId, t.remoteEntity),
}));

export const auditLog = pgTable("audit_log", {
  id:             bigserial("id", { mode: "bigint" }).primaryKey(),
  organisationId: uuid("organisation_id"),
  actorId:        uuid("actor_id"),
  actorEmail:     text("actor_email"),
  action:         text("action").notNull(),
  entityType:     text("entity_type").notNull(),
  entityId:       uuid("entity_id"),
  diff:           jsonb("diff"),
  ipAddress:      inet("ip_address"),
  userAgent:      text("user_agent"),
  at:             timestamp("at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxEntity: index("idx_audit_entity").on(t.entityType, t.entityId, t.at),
  idxActor:  index("idx_audit_actor").on(t.actorId, t.at),
}));

export const permissionOverrides = pgTable("permission_overrides", {
  id:             uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  profileId:      uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  scope:          text("scope").notNull(),
  scopeId:        uuid("scope_id"),
  capability:     text("capability").notNull(),
  granted:        boolean("granted").notNull().default(true),
  expiresAt:      timestamp("expires_at", { withTimezone: true }),
  createdAt,
});

export const dataRetentionPolicies = pgTable("data_retention_policies", {
  id:               uuid("id").primaryKey().defaultRandom(),
  organisationId:   uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  entityType:       text("entity_type").notNull(),
  retainDays:       integer("retain_days").notNull(),
  lastEnforcedAt:   timestamp("last_enforced_at", { withTimezone: true }),
}, (t) => ({
  uniq: unique().on(t.organisationId, t.entityType),
}));

// -----------------------------------------------------------------------------
// Relations (selective — Drizzle needs these for the `with:` join syntax)
// -----------------------------------------------------------------------------
export const projectsRelations = relations(projects, ({ one, many }) => ({
  organisation: one(organisations, { fields: [projects.organisationId], references: [organisations.id] }),
  template:     one(submissionTemplates, { fields: [projects.templateId], references: [submissionTemplates.id] }),
  portfolio:    one(portfolios, { fields: [projects.portfolioId], references: [portfolios.id] }),
  programme:    one(programmes, { fields: [projects.programmeId], references: [programmes.id] }),
  sponsor:      one(profiles, { fields: [projects.sponsorId], references: [profiles.id] }),
  initiatives:  many(initiatives),
  members:      many(members),
  submissions:  many(submissions),
  deliverables: many(deliverables),
  risks:        many(risks),
  budgetLines:  many(budgetLines),
  milestones:   many(milestones),
}));

export const initiativesRelations = relations(initiatives, ({ one, many }) => ({
  project:     one(projects, { fields: [initiatives.projectId], references: [projects.id] }),
  champion:    one(profiles, { fields: [initiatives.championId], references: [profiles.id] }),
  io:          one(profiles, { fields: [initiatives.ioId], references: [profiles.id] }),
  submissions: many(submissions),
}));

export const submissionsRelations = relations(submissions, ({ one, many }) => ({
  project:    one(projects,    { fields: [submissions.projectId],    references: [projects.id] }),
  initiative: one(initiatives, { fields: [submissions.initiativeId], references: [initiatives.id] }),
  submitter:  one(profiles,    { fields: [submissions.submittedBy],  references: [profiles.id] }),
  documents:  many(documents),
}));

export const membersRelations = relations(members, ({ one }) => ({
  project: one(projects, { fields: [members.projectId], references: [projects.id] }),
  profile: one(profiles, { fields: [members.profileId], references: [profiles.id] }),
  initiative: one(initiatives, { fields: [members.initiativeId], references: [initiatives.id] }),
}));

export const deliverablesRelations = relations(deliverables, ({ one, many }) => ({
  project:    one(projects,    { fields: [deliverables.projectId],    references: [projects.id] }),
  initiative: one(initiatives, { fields: [deliverables.initiativeId], references: [initiatives.id] }),
  owner:      one(profiles,    { fields: [deliverables.ownerId],      references: [profiles.id] }),
  milestone:  one(milestones,  { fields: [deliverables.milestoneId],  references: [milestones.id] }),
  evidence:   one(documents,   { fields: [deliverables.evidenceDocumentId], references: [documents.id] }),
  risks:      many(risks),
}));

export const budgetLinesRelations = relations(budgetLines, ({ one, many }) => ({
  project:    one(projects,    { fields: [budgetLines.projectId],    references: [projects.id] }),
  initiative: one(initiatives, { fields: [budgetLines.initiativeId], references: [initiatives.id] }),
  actuals:    many(budgetActuals),
}));

export const risksRelations = relations(risks, ({ one }) => ({
  project:    one(projects,    { fields: [risks.projectId],    references: [projects.id] }),
  initiative: one(initiatives, { fields: [risks.initiativeId], references: [initiatives.id] }),
  owner:      one(profiles,    { fields: [risks.ownerId],      references: [profiles.id] }),
  deliverable: one(deliverables, { fields: [risks.relatedDeliverableId], references: [deliverables.id] }),
  budgetLine:  one(budgetLines,  { fields: [risks.relatedBudgetLineId],  references: [budgetLines.id] }),
}));

// -----------------------------------------------------------------------------
// Exported inferred types — replace hand-rolled src/types/database.ts usage.
// -----------------------------------------------------------------------------
export type Organisation = typeof organisations.$inferSelect;
export type Profile      = typeof profiles.$inferSelect;
export type Project      = typeof projects.$inferSelect;
export type Initiative   = typeof initiatives.$inferSelect;
export type Member       = typeof members.$inferSelect;
export type Submission   = typeof submissions.$inferSelect;
export type Document     = typeof documents.$inferSelect;
export type ReportRun    = typeof reportRuns.$inferSelect;
export type Deliverable  = typeof deliverables.$inferSelect;
export type Milestone    = typeof milestones.$inferSelect;
export type Risk         = typeof risks.$inferSelect;
export type BudgetLine   = typeof budgetLines.$inferSelect;
export type AiInsight    = typeof aiInsights.$inferSelect;
export type Alert        = typeof alerts.$inferSelect;
