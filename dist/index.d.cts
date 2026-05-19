/**
 * Canonical types matching the SEOReport REST API v1 response shapes.
 * Source of truth: seoreport-api/src/routes/reports-helpers.ts
 */
type ReportStage = "queued" | "materializing" | "snapshot_ready" | "artifact" | "done";
type ReportStatus = "queued" | "running" | "completed" | "failed" | "dead_lettered" | "cancelled";
type ReportAttachMode = "new_run" | "attached_inflight" | "reused_snapshot";
type ReportRequestKind = "anonymous" | "account" | "paid" | "api" | "actor";
type ReportEntitlementState = "anonymous" | "account" | "paid" | "api";
type ReportSectionVisibility = "free" | "paid";
type ReportViewSectionState = "placeholder" | "materializing" | "ready" | "locked";
interface ReportViewSection {
    key: string;
    visibility: ReportSectionVisibility;
    state: ReportViewSectionState;
    headline: string;
    summary: string;
    detail: Record<string, unknown> | null;
    updatedAt: string;
}
interface ReportViewDocument {
    viewVersion: string;
    jobId: string;
    stage: ReportStage;
    isSnapshotReady: boolean;
    targetUrl: string;
    sections: ReportViewSection[];
}
interface CategoryScore {
    category: string;
    score: number;
    weight: number;
    checks: number;
    pass: number;
    fail: number;
    warn: number;
    info: number;
}
interface DomainScore {
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
interface ReportScore {
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
interface ReportPreview {
    sectionKeys: string[];
    readySectionKeys: string[];
    topFindingKeys: string[];
}
interface ReportPaidUnlock {
    sectionKeys: string[];
    lockedSectionKeys: string[];
    unlockEligible: boolean;
    unlocked: boolean;
}
interface ReportAdvancedPreview {
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
interface ReportBeforeAfterAddon {
    eligible: boolean;
    priorSnapshotId: string | null;
}
interface ReportPresentationPayload {
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
interface SubmissionError {
    code: string;
    message: string;
    action?: string;
}
interface ReportEnvelope {
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
interface RateGate {
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
interface SubmitEnvelopeSuccess {
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
interface SubmitEnvelopeGate {
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
type SubmitEnvelope = SubmitEnvelopeSuccess | SubmitEnvelopeGate;
interface CreateReportOptions {
    locale?: string;
    forceRerun?: boolean;
}
interface PollReportOptions {
    maxWaitMs?: number;
    onProgress?: (report: ReportPresentationPayload) => void;
    signal?: AbortSignal;
}
interface SEOReportClientConfig {
    apiKey: string;
    baseUrl?: string;
    schemaVersion?: string;
}
interface RateLimitInfo {
    limit: number;
    remaining: number;
    resetAt: number;
    retryAfterSeconds?: number;
}
interface PreviewScore {
    overall: number | null;
    band: string | null;
    basis: string | null;
    domainScores: DomainScore[] | null;
}
interface PreviewPayload {
    jobId: string;
    targetUrl: string;
    score: PreviewScore;
    reportUrl: string;
    upgradeUrl: string;
}
interface PreviewEnvelope {
    success: true;
    schemaVersion: string;
    preview: PreviewPayload;
    pollAfterMs: number;
}
interface PreviewGate {
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
type PreviewResponse = PreviewEnvelope | PreviewGate;
type ReportDownloadFormat = "pdf" | "md" | "txt" | "json";

declare class SEOReportClient {
    private readonly apiKey;
    private readonly baseUrl;
    private readonly schemaVersion;
    constructor(config: SEOReportClientConfig);
    private request;
    /**
     * Create a score preview for the given URL.
     * Returns a stripped preview with overall score, band, and domain breakdown.
     * Requires an API key. Free accounts get limited previews per hour.
     */
    createPreview(url: string, options?: {
        locale?: string;
    }): Promise<PreviewResponse>;
    /**
     * Create a new SEO report for the given URL.
     * Returns the report envelope with initial status and polling guidance.
     */
    createReport(url: string, options?: CreateReportOptions): Promise<SubmitEnvelope>;
    /**
     * Get the current status of a report by job ID.
     */
    getReport(jobId: string): Promise<ReportPresentationPayload>;
    /**
     * Get the full result payload for a completed report.
     */
    getResult(jobId: string): Promise<ReportPresentationPayload>;
    /**
     * Poll a report until it reaches a terminal state (completed or failed).
     * Respects the server's `pollAfterMs` guidance and uses exponential backoff.
     */
    pollReport(jobId: string, options?: PollReportOptions): Promise<ReportPresentationPayload>;
    /**
     * Convenience method: create a report and poll until ready.
     */
    createAndPoll(url: string, createOptions?: CreateReportOptions, pollOptions?: Omit<PollReportOptions, "maxWaitMs"> & {
        maxWaitMs?: number;
    }): Promise<ReportPresentationPayload>;
    /**
     * Download a report artifact in the given format.
     * Returns a Blob for pdf/md/txt, or a JSON object for json format.
     */
    downloadArtifact(jobId: string, format?: ReportDownloadFormat): Promise<Blob>;
    /**
     * Return the canonical MCP endpoint URL.
     */
    getMcpEndpoint(): string;
}

declare function pollWithBackoff(fetchReport: () => Promise<ReportPresentationPayload>, options: {
    pollAfterMs: number;
    maxWaitMs: number;
    onProgress?: (report: ReportPresentationPayload) => void;
    signal?: AbortSignal;
}): Promise<ReportPresentationPayload>;

declare class SEOReportError extends Error {
    code: string;
    status: number;
    constructor(code: string, message: string, status: number);
}
declare class RateLimitError extends SEOReportError {
    rateLimit: {
        limit: number;
        remaining: number;
        resetAt: number;
        retryAfterSeconds?: number;
    };
    constructor(message: string, rateLimit: {
        limit: number;
        remaining: number;
        resetAt: number;
        retryAfterSeconds?: number;
    });
}
declare class AuthenticationError extends SEOReportError {
    constructor(message?: string);
}
declare class ValidationError extends SEOReportError {
    constructor(message: string);
}
declare class TimeoutError extends SEOReportError {
    constructor(message?: string);
}
declare class ServerError extends SEOReportError {
    constructor(message?: string, status?: number);
}

export { AuthenticationError, type CategoryScore, type CreateReportOptions, type DomainScore, type PollReportOptions, type PreviewEnvelope, type PreviewGate, type PreviewPayload, type PreviewResponse, type PreviewScore, type RateGate, RateLimitError, type RateLimitInfo, type ReportAdvancedPreview, type ReportAttachMode, type ReportBeforeAfterAddon, type ReportDownloadFormat, type ReportEntitlementState, type ReportEnvelope, type ReportPaidUnlock, type ReportPresentationPayload, type ReportPreview, type ReportRequestKind, type ReportScore, type ReportSectionVisibility, type ReportStage, type ReportStatus, type ReportViewDocument, type ReportViewSection, type ReportViewSectionState, SEOReportClient, type SEOReportClientConfig, SEOReportError, ServerError, type SubmissionError, type SubmitEnvelope, type SubmitEnvelopeGate, type SubmitEnvelopeSuccess, TimeoutError, ValidationError, pollWithBackoff };
