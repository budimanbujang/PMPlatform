// Hand-maintained subset of the generated Supabase types.
// Regenerate with: supabase gen types typescript --local > src/types/database.ts
// This file stays in sync with the migrations under supabase/migrations.

export type UUID = string;

export type ProjectStatus = "draft" | "active" | "on_hold" | "closed" | "archived";
export type ProjectRag = "green" | "amber" | "red" | "grey";
export type SubmissionStatus = "draft" | "submitted" | "late" | "missed" | "void";
export type MemberRole =
  | "sponsor" | "executive" | "pmo" | "tmo" | "iwc"
  | "champion" | "io" | "delivery_lead" | "finance_controller"
  | "steering" | "viewer";
export type DocumentTag = "evidence" | "deliverable" | "reference" | "other";
export type DeliverableStatus = "not_started" | "in_progress" | "blocked" | "complete" | "cancelled";
export type RiskSeverity = "low" | "medium" | "high" | "critical";
export type RiskLikelihood = "rare" | "unlikely" | "possible" | "likely" | "almost_certain";
export type RiskStatus = "open" | "mitigating" | "closed" | "accepted";
export type InsightKind =
  | "weekly_digest" | "anomaly" | "pattern"
  | "compliance_gap" | "reporting_gap" | "resource_gap" | "dependency_gap"
  | "predictive";
export type InsightSeverity = "info" | "notice" | "warn" | "critical";

export interface Organisation {
  id: UUID;
  slug: string;
  name: string;
  brand_primary: string | null;
  brand_logo: string | null;
  domain: string | null;
  region: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: UUID;
  organisation_id: UUID | null;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
  department: string | null;
  is_platform_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: UUID;
  organisation_id: UUID;
  code: string;
  name: string;
  description: string | null;
  department: string | null;
  sponsor_id: UUID | null;
  status: ProjectStatus;
  rag: ProjectRag;
  cadence: "weekly" | "biweekly" | "monthly";
  submission_deadline_dow: number | null;
  submission_deadline_time: string | null;
  report_day_dow: number | null;
  report_time: string | null;
  template_id: UUID | null;
  programme_id: UUID | null;
  portfolio_id: UUID | null;
  start_date: string | null;
  target_end_date: string | null;
  closed_at: string | null;
  created_by: UUID | null;
  created_at: string;
  updated_at: string;
}

export interface Initiative {
  id: UUID;
  organisation_id: UUID;
  project_id: UUID;
  code: string;
  name: string;
  description: string | null;
  champion_id: UUID | null;
  io_id: UUID | null;
  rag: ProjectRag;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Member {
  id: UUID;
  organisation_id: UUID;
  project_id: UUID;
  profile_id: UUID;
  role: MemberRole;
  initiative_id: UUID | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubmissionTemplate {
  id: UUID;
  organisation_id: UUID;
  name: string;
  description: string | null;
  modules: TemplateModule[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemplateModule {
  key: string;
  title: string;
  fields: TemplateField[];
}

export interface TemplateField {
  key: string;
  type:
    | "rag" | "number" | "currency" | "short_text" | "long_text"
    | "date" | "file" | "toggle" | "dropdown" | "multi_select" | "user_picker";
  label: string;
  required?: boolean;
  help_text?: string;
  options?: Array<{ value: string; label: string }>;
  tags?: string[];
  visible_when?: Record<string, unknown>;
  visible_roles?: MemberRole[];
}

export interface Submission {
  id: UUID;
  organisation_id: UUID;
  project_id: UUID;
  initiative_id: UUID | null;
  period_start: string;
  period_end: string;
  due_at: string;
  submitted_at: string | null;
  submitted_by: UUID | null;
  status: SubmissionStatus;
  rag: ProjectRag;
  progress_pct: number | null;
  headline: string | null;
  progress_notes: string | null;
  risks_text: string | null;
  issues_text: string | null;
  narrative: string | null;
  escalate: boolean;
  escalate_reason: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DocumentRow {
  id: UUID;
  organisation_id: UUID;
  project_id: UUID | null;
  initiative_id: UUID | null;
  submission_id: UUID | null;
  deliverable_id: UUID | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  tag: DocumentTag;
  description: string | null;
  uploaded_by: UUID | null;
  created_at: string;
}

export interface ReportRun {
  id: UUID;
  organisation_id: UUID;
  project_id: UUID;
  period_start: string;
  period_end: string;
  status: "queued" | "generating" | "succeeded" | "failed";
  narrative_md: string | null;
  pdf_path: string | null;
  input_payload: unknown;
  error_message: string | null;
  ai_model: string | null;
  ai_input_tokens: number | null;
  ai_output_tokens: number | null;
  ai_latency_ms: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface Deliverable {
  id: UUID;
  organisation_id: UUID;
  project_id: UUID;
  initiative_id: UUID | null;
  milestone_id: UUID | null;
  title: string;
  description: string | null;
  acceptance_criteria: string | null;
  owner_id: UUID | null;
  due_date: string | null;
  status: DeliverableStatus;
  completed_at: string | null;
  evidence_document_id: UUID | null;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: UUID;
  organisation_id: UUID;
  project_id: UUID;
  name: string;
  target_date: string;
  day_marker: number | null;
  status: DeliverableStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Risk {
  id: UUID;
  organisation_id: UUID;
  project_id: UUID;
  initiative_id: UUID | null;
  title: string;
  description: string | null;
  severity: RiskSeverity;
  likelihood: RiskLikelihood;
  score: number;
  status: RiskStatus;
  mitigation: string | null;
  owner_id: UUID | null;
  next_review_at: string | null;
  related_deliverable_id: UUID | null;
  related_budget_line_id: UUID | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetLine {
  id: UUID;
  organisation_id: UUID;
  project_id: UUID;
  initiative_id: UUID | null;
  year: number;
  quarter: number | null;
  category: "capex" | "opex" | "vendor" | "licensing" | "people" | "contingency" | "other";
  description: string;
  currency: string;
  planned_amount: number;
  committed_amount: number;
  created_at: string;
  updated_at: string;
}

export interface AiInsight {
  id: UUID;
  organisation_id: UUID;
  scope: "organisation" | "portfolio" | "programme" | "project";
  scope_id: UUID | null;
  kind: InsightKind;
  severity: InsightSeverity;
  headline: string;
  body_md: string | null;
  supporting_data: Record<string, unknown> | null;
  generated_at: string;
  acknowledged_at: string | null;
  acknowledged_by: UUID | null;
  expires_at: string | null;
}
