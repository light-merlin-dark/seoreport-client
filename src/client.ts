import type {
  CreateReportOptions,
  PollReportOptions,
  ReportPresentationPayload,
  SEOReportClientConfig,
  SubmitEnvelope,
  PreviewResponse,
  ReportDownloadFormat,
} from "./types";
import {
  AuthenticationError,
  RateLimitError,
  ServerError,
  ValidationError,
} from "./errors";
import { pollWithBackoff } from "./polling";

const DEFAULT_BASE_URL = "https://seoreport.dev";
const DEFAULT_SCHEMA_VERSION = "2025-05-18";

function parseRateLimitHeaders(response: Response): {
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds?: number;
} {
  const limit = Number(response.headers.get("x-ratelimit-limit") ?? "0");
  const remaining = Number(response.headers.get("x-ratelimit-remaining") ?? "0");
  const resetAt = Number(response.headers.get("x-ratelimit-reset") ?? "0");
  const retryAfter = response.headers.get("retry-after");
  return {
    limit,
    remaining,
    resetAt,
    retryAfterSeconds: retryAfter ? Number(retryAfter) : undefined,
  };
}

function handleErrorResponse(response: Response, body: unknown): never {
  const rateLimit = parseRateLimitHeaders(response);

  if (response.status === 429) {
    throw new RateLimitError(
      typeof body === "object" && body !== null && "error" in body
        ? String((body as Record<string, unknown>).error)
        : "Rate limit exceeded.",
      rateLimit
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new AuthenticationError(
      typeof body === "object" && body !== null && "error" in body
        ? String((body as Record<string, unknown>).error)
        : undefined
    );
  }

  if (response.status === 400) {
    throw new ValidationError(
      typeof body === "object" && body !== null && "error" in body
        ? String((body as Record<string, unknown>).error)
        : "Invalid request."
    );
  }

  throw new ServerError(
    typeof body === "object" && body !== null && "error" in body
      ? String((body as Record<string, unknown>).error)
      : `Server error (${response.status}).`,
    response.status
  );
}

export class SEOReportClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly schemaVersion: string;

  constructor(config: SEOReportClientConfig) {
    if (!config.apiKey || config.apiKey.trim().length === 0) {
      throw new ValidationError("apiKey is required.");
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.schemaVersion = config.schemaVersion ?? DEFAULT_SCHEMA_VERSION;
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Seoreport-Schema-Version": this.schemaVersion,
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const responseBody = await response.json().catch(() => null);

    if (!response.ok) {
      handleErrorResponse(response, responseBody);
    }

    return responseBody as T;
  }

  /**
   * Create a score preview for the given URL.
   * Returns a stripped preview with overall score, band, and domain breakdown.
   * Requires an API key. Free accounts get limited previews per hour.
   */
  async createPreview(
    url: string,
    options: { locale?: string } = {}
  ): Promise<PreviewResponse> {
    if (!url || url.trim().length === 0) {
      throw new ValidationError("url is required.");
    }
    return this.request<PreviewResponse>("POST", "/api/v1/reports/preview", {
      url,
      locale: options.locale,
    });
  }

  /**
   * Create a new SEO report for the given URL.
   * Returns the report envelope with initial status and polling guidance.
   */
  async createReport(
    url: string,
    options: CreateReportOptions = {}
  ): Promise<SubmitEnvelope> {
    if (!url || url.trim().length === 0) {
      throw new ValidationError("url is required.");
    }
    return this.request<SubmitEnvelope>("POST", "/api/v1/reports", {
      url,
      locale: options.locale,
      forceRerun: options.forceRerun,
    });
  }

  /**
   * Get the current status of a report by job ID.
   */
  async getReport(jobId: string): Promise<ReportPresentationPayload> {
    if (!jobId || jobId.trim().length === 0) {
      throw new ValidationError("jobId is required.");
    }
    const envelope = await this.request<{
      success: boolean;
      report: ReportPresentationPayload;
    }>("GET", `/api/v1/reports/${encodeURIComponent(jobId)}`);
    return envelope.report;
  }

  /**
   * Get the full result payload for a completed report.
   */
  async getResult(jobId: string): Promise<ReportPresentationPayload> {
    if (!jobId || jobId.trim().length === 0) {
      throw new ValidationError("jobId is required.");
    }
    const envelope = await this.request<{
      success: boolean;
      report: ReportPresentationPayload;
    }>("GET", `/api/v1/reports/${encodeURIComponent(jobId)}/result`);
    return envelope.report;
  }

  /**
   * Poll a report until it reaches a terminal state (completed or failed).
   * Respects the server's `pollAfterMs` guidance and uses exponential backoff.
   */
  async pollReport(
    jobId: string,
    options: PollReportOptions = {}
  ): Promise<ReportPresentationPayload> {
    const { maxWaitMs = 30_000, onProgress, signal } = options;

    // First fetch to get pollAfterMs guidance
    const initial = await this.getReport(jobId);
    onProgress?.(initial);

    if (initial.status === "completed" || initial.status === "failed") {
      return initial;
    }

    if (initial.isSnapshotReady && initial.stage === "snapshot_ready") {
      return initial;
    }

    return pollWithBackoff(
      () => this.getReport(jobId),
      {
        pollAfterMs: 0,
        maxWaitMs: Math.max(0, maxWaitMs - (Date.now() - Date.now())),
        onProgress,
        signal,
      }
    );
  }

  /**
   * Convenience method: create a report and poll until ready.
   */
  async createAndPoll(
    url: string,
    createOptions: CreateReportOptions = {},
    pollOptions: Omit<PollReportOptions, "maxWaitMs"> & { maxWaitMs?: number } = {}
  ): Promise<ReportPresentationPayload> {
    const submit = await this.createReport(url, createOptions);

    if (!submit.success) {
      throw new ValidationError(submit.error);
    }

    return this.pollReport(submit.report.jobId, pollOptions);
  }

  /**
   * Download a report artifact in the given format.
   * Returns a Blob for pdf/md/txt, or a JSON object for json format.
   */
  async downloadArtifact(
    jobId: string,
    format: ReportDownloadFormat = "pdf"
  ): Promise<Blob> {
    if (!jobId || jobId.trim().length === 0) {
      throw new ValidationError("jobId is required.");
    }

    const url = `${this.baseUrl}/api/v1/reports/${encodeURIComponent(jobId)}/download?format=${format}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "X-Seoreport-Schema-Version": this.schemaVersion,
      },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      handleErrorResponse(response, body);
    }

    return response.blob();
  }

  /**
   * Return the canonical MCP endpoint URL.
   */
  getMcpEndpoint(): string {
    return `${this.baseUrl}/api/mcp`;
  }
}
