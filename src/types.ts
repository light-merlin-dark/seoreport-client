/**
 * Canonical types matching the SEOReport REST API v1 response shapes.
 * Source of truth: seoreport-api/src/routes/reports-helpers.ts
 */

export type ReportStage =
  | "queued"
  | "materializing"
  | "snapshot_ready"
  | "artifact"
  | "done";

export type ReportStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "dead_lettered"
  | "cancelled";

export type ReportAttachMode = "new_run" | "attached_inflight" | "reused_snapshot";

export type ReportRequestKind = "anonymous" | "account" | "paid" | "api" | "actor";

export type ReportEntitlementState = "anonymous" | "account" | "paid" | "api";

export type ReportSectionVisibility = "free" | "paid";

export type ReportViewSectionState = "placeholder" | "materializing" | "ready" | "locked";

export interface ReportViewSection {
  key: string;
  visibility: ReportSectionVisibility;
  state: ReportViewSectionState;
  headline: string;
  summary: string;
  detail: Record<string, unknown> | null;
  updatedAt: string;
}

export interface ReportViewDocument {
  viewVersion: string;
  jobId: string;
  stage: ReportStage;
  isSnapshotReady: boolean;
  targetUrl: string;
  sections: ReportViewSection[];
}

export interface CategoryScore {
  category: string;
  score: number;
  weight: number;
  checks: number;
  pass: number;
  fail: number;
  warn: number;
  info: number;
}

export interface DomainScore {
  domain: "seo" | "ai" | "performance" | "security" | "brand";
  label: string;
  score: number;
  weight: number;
  checks: number;
  pass: number;
  fail: number;
  warn: number;
  info: number;
}

export interface ReportScore {
  overall: number | null;
  band: string | null;
  basis: string | null;
  totalChecks: number | null;
  passedChecks: number | null;
  failedChecks: number | null;
  warnChecks: number | null;
  inconclusiveChecks: number | null;
  failingCriticalChecks: number | null;
  coverageConfidence: number | null;
  categoryScores: CategoryScore[] | null;
  domainScores: DomainScore[] | null;
}

export interface ReportPreview {
  sectionKeys: string[];
  readySectionKeys: string[];
  topFindingKeys: string[];
}

export interface ReportPaidUnlock {
  sectionKeys: string[];
  lockedSectionKeys: string[];
  unlockEligible: boolean;
  unlocked: boolean;
}

export interface ReportAdvancedPreview {
  fixCount: number | null;
  findingCount: number | null;
  categoryBreakdown: string | null;
  estimatedPages: string;
  coverageHeadline: string;
  coverageSummary: string;
  includesPdf: boolean;
  focusAreas: string[];
  lockedFindingTitles: string[];
}

export interface ReportBeforeAfterAddon {
  eligible: boolean;
  priorSnapshotId: string | null;
}

export interface ReportPresentationPayload {
  presentationVersion: string;
  jobId: string;
  targetUrl: string;
  stage: ReportStage;
  status: ReportStatus;
  attachMode: ReportAttachMode | null;
  requestKind: ReportRequestKind;
  entitlementState: ReportEntitlementState;
  snapshotId: string | null;
  isSnapshotReady: boolean;
  previewProjectionRef: string | null;
  score: ReportScore;
  view: ReportViewDocument;
  preview: ReportPreview;
  paidUnlock: ReportPaidUnlock;
  advancedPreview: ReportAdvancedPreview;
  beforeAfterAddon: ReportBeforeAfterAddon;
}

export interface SubmissionError {
  code: string;
  message: string;
  action?: string;
}

export interface ReportEnvelope {
  success: true;
  report: ReportPresentationPayload;
  pollAfterMs: number;
  submissionError?: SubmissionError;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
    traceId: string | null;
    runId: string | null;
  };
}

export interface RateGate {
  gateType: "sign_up" | "upgrade";
  retryAfterSeconds: number;
  resetAt: number;
  limit: number;
  windowHours: number;
  ctaUrl: string;
  ctaLabel: string;
  context?: {
    domain: string;
    currentUrl: string;
  };
}

export interface SubmitEnvelopeSuccess {
  success: true;
  report: ReportPresentationPayload;
  pollAfterMs: number;
  routeUrl: string;
  submission: {
    reusedSnapshot: boolean;
    attachMode: ReportAttachMode | null;
  };
  submissionError?: SubmissionError;
}

export interface SubmitEnvelopeGate {
  success: false;
  error: string;
  gate: RateGate;
  routeUrl: string;
  report?: null;
  pollAfterMs?: number;
  submission?: {
    reusedSnapshot: boolean;
    attachMode: null;
  };
}

export type SubmitEnvelope = SubmitEnvelopeSuccess | SubmitEnvelopeGate;

export interface CreateReportOptions {
  locale?: string;
  forceRerun?: boolean;
}

export interface PollReportOptions {
  maxWaitMs?: number;
  onProgress?: (report: ReportPresentationPayload) => void;
  signal?: AbortSignal;
}

export interface SEOReportClientConfig {
  apiKey: string;
  baseUrl?: string;
  schemaVersion?: string;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds?: number;
}

export interface PreviewScore {
  overall: number | null;
  band: string | null;
  basis: string | null;
  domainScores: DomainScore[] | null;
}

export interface PreviewPayload {
  jobId: string;
  targetUrl: string;
  score: PreviewScore;
  reportUrl: string;
  upgradeUrl: string;
}

export interface PreviewEnvelope {
  success: true;
  schemaVersion: string;
  preview: PreviewPayload;
  pollAfterMs: number;
}

export interface PreviewGate {
  success: false;
  error: string;
  gate: {
    gateType: string;
    limit: number;
    used: number;
    resetAt: number;
    ctaUrl: string;
    ctaLabel: string;
  };
}

export type PreviewResponse = PreviewEnvelope | PreviewGate;

export type ReportDownloadFormat = "pdf" | "md" | "txt" | "json";
