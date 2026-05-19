"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AuthenticationError: () => AuthenticationError,
  RateLimitError: () => RateLimitError,
  SEOReportClient: () => SEOReportClient,
  SEOReportError: () => SEOReportError,
  ServerError: () => ServerError,
  TimeoutError: () => TimeoutError,
  ValidationError: () => ValidationError,
  pollWithBackoff: () => pollWithBackoff
});
module.exports = __toCommonJS(index_exports);

// src/errors.ts
var SEOReportError = class _SEOReportError extends Error {
  code;
  status;
  constructor(code, message, status) {
    super(message);
    this.name = "SEOReportError";
    this.code = code;
    this.status = status;
    Object.setPrototypeOf(this, _SEOReportError.prototype);
  }
};
var RateLimitError = class _RateLimitError extends SEOReportError {
  rateLimit;
  constructor(message, rateLimit) {
    super("rate_limit", message, 429);
    this.name = "RateLimitError";
    this.rateLimit = rateLimit;
    Object.setPrototypeOf(this, _RateLimitError.prototype);
  }
};
var AuthenticationError = class _AuthenticationError extends SEOReportError {
  constructor(message = "Invalid or revoked API key.") {
    super("authentication_error", message, 401);
    this.name = "AuthenticationError";
    Object.setPrototypeOf(this, _AuthenticationError.prototype);
  }
};
var ValidationError = class _ValidationError extends SEOReportError {
  constructor(message) {
    super("validation_error", message, 400);
    this.name = "ValidationError";
    Object.setPrototypeOf(this, _ValidationError.prototype);
  }
};
var TimeoutError = class _TimeoutError extends SEOReportError {
  constructor(message = "Report polling timed out.") {
    super("timeout", message, 408);
    this.name = "TimeoutError";
    Object.setPrototypeOf(this, _TimeoutError.prototype);
  }
};
var ServerError = class _ServerError extends SEOReportError {
  constructor(message = "Server error.", status = 500) {
    super("server_error", message, status);
    this.name = "ServerError";
    Object.setPrototypeOf(this, _ServerError.prototype);
  }
};

// src/polling.ts
var DEFAULT_BACKOFF_MS = [500, 1e3, 2e3, 4e3, 8e3];
function computeDelay(state, pollAfterMs) {
  const elapsed = Date.now() - state.startTime;
  const remaining = pollAfterMs - elapsed;
  if (remaining > 0) return remaining;
  const backoff = DEFAULT_BACKOFF_MS[Math.min(state.attempt, DEFAULT_BACKOFF_MS.length - 1)];
  return backoff;
}
async function pollWithBackoff(fetchReport, options) {
  const { pollAfterMs, maxWaitMs, onProgress, signal } = options;
  const state = {
    attempt: 0,
    startTime: Date.now(),
    report: null
  };
  while (true) {
    if (signal?.aborted) {
      throw new TimeoutError("Polling was cancelled.");
    }
    const elapsed = Date.now() - state.startTime;
    if (elapsed >= maxWaitMs) {
      throw new TimeoutError(`Report did not complete within ${maxWaitMs}ms.`);
    }
    const delay = computeDelay(state, pollAfterMs);
    const cappedDelay = Math.min(delay, maxWaitMs - elapsed);
    if (cappedDelay > 0) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, cappedDelay);
        signal?.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(new TimeoutError("Polling was cancelled."));
          },
          { once: true }
        );
      });
    }
    const report = await fetchReport();
    state.attempt += 1;
    state.report = report;
    onProgress?.(report);
    if (report.status === "completed" || report.status === "failed") {
      return report;
    }
    if (report.isSnapshotReady && report.stage === "snapshot_ready") {
      return report;
    }
  }
}

// src/client.ts
var DEFAULT_BASE_URL = "https://seoreport.dev";
var DEFAULT_SCHEMA_VERSION = "2025-05-18";
function parseRateLimitHeaders(response) {
  const limit = Number(response.headers.get("x-ratelimit-limit") ?? "0");
  const remaining = Number(response.headers.get("x-ratelimit-remaining") ?? "0");
  const resetAt = Number(response.headers.get("x-ratelimit-reset") ?? "0");
  const retryAfter = response.headers.get("retry-after");
  return {
    limit,
    remaining,
    resetAt,
    retryAfterSeconds: retryAfter ? Number(retryAfter) : void 0
  };
}
function handleErrorResponse(response, body) {
  const rateLimit = parseRateLimitHeaders(response);
  if (response.status === 429) {
    throw new RateLimitError(
      typeof body === "object" && body !== null && "error" in body ? String(body.error) : "Rate limit exceeded.",
      rateLimit
    );
  }
  if (response.status === 401 || response.status === 403) {
    throw new AuthenticationError(
      typeof body === "object" && body !== null && "error" in body ? String(body.error) : void 0
    );
  }
  if (response.status === 400) {
    throw new ValidationError(
      typeof body === "object" && body !== null && "error" in body ? String(body.error) : "Invalid request."
    );
  }
  throw new ServerError(
    typeof body === "object" && body !== null && "error" in body ? String(body.error) : `Server error (${response.status}).`,
    response.status
  );
}
var SEOReportClient = class {
  apiKey;
  baseUrl;
  schemaVersion;
  constructor(config) {
    if (!config.apiKey || config.apiKey.trim().length === 0) {
      throw new ValidationError("apiKey is required.");
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.schemaVersion = config.schemaVersion ?? DEFAULT_SCHEMA_VERSION;
  }
  async request(method, path, body) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Seoreport-Schema-Version": this.schemaVersion
    };
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : void 0
    });
    const responseBody = await response.json().catch(() => null);
    if (!response.ok) {
      handleErrorResponse(response, responseBody);
    }
    return responseBody;
  }
  /**
   * Create a score preview for the given URL.
   * Returns a stripped preview with overall score, band, and domain breakdown.
   * Requires an API key. Free accounts get limited previews per hour.
   */
  async createPreview(url, options = {}) {
    if (!url || url.trim().length === 0) {
      throw new ValidationError("url is required.");
    }
    return this.request("POST", "/api/v1/reports/preview", {
      url,
      locale: options.locale
    });
  }
  /**
   * Create a new SEO report for the given URL.
   * Returns the report envelope with initial status and polling guidance.
   */
  async createReport(url, options = {}) {
    if (!url || url.trim().length === 0) {
      throw new ValidationError("url is required.");
    }
    return this.request("POST", "/api/v1/reports", {
      url,
      locale: options.locale,
      forceRerun: options.forceRerun
    });
  }
  /**
   * Get the current status of a report by job ID.
   */
  async getReport(jobId) {
    if (!jobId || jobId.trim().length === 0) {
      throw new ValidationError("jobId is required.");
    }
    const envelope = await this.request("GET", `/api/v1/reports/${encodeURIComponent(jobId)}`);
    return envelope.report;
  }
  /**
   * Get the full result payload for a completed report.
   */
  async getResult(jobId) {
    if (!jobId || jobId.trim().length === 0) {
      throw new ValidationError("jobId is required.");
    }
    const envelope = await this.request("GET", `/api/v1/reports/${encodeURIComponent(jobId)}/result`);
    return envelope.report;
  }
  /**
   * Poll a report until it reaches a terminal state (completed or failed).
   * Respects the server's `pollAfterMs` guidance and uses exponential backoff.
   */
  async pollReport(jobId, options = {}) {
    const { maxWaitMs = 3e4, onProgress, signal } = options;
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
        signal
      }
    );
  }
  /**
   * Convenience method: create a report and poll until ready.
   */
  async createAndPoll(url, createOptions = {}, pollOptions = {}) {
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
  async downloadArtifact(jobId, format = "pdf") {
    if (!jobId || jobId.trim().length === 0) {
      throw new ValidationError("jobId is required.");
    }
    const url = `${this.baseUrl}/api/v1/reports/${encodeURIComponent(jobId)}/download?format=${format}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "X-Seoreport-Schema-Version": this.schemaVersion
      }
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
  getMcpEndpoint() {
    return `${this.baseUrl}/mcp`;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AuthenticationError,
  RateLimitError,
  SEOReportClient,
  SEOReportError,
  ServerError,
  TimeoutError,
  ValidationError,
  pollWithBackoff
});
