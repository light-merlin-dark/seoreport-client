import { TimeoutError } from "./errors";
import type { ReportPresentationPayload } from "./types";

const DEFAULT_BACKOFF_MS = [500, 1_000, 2_000, 4_000, 8_000];

function computeDelay(state: { attempt: number; startTime: number }, pollAfterMs: number): number {
  const elapsed = Date.now() - state.startTime;
  const remaining = pollAfterMs - elapsed;
  if (remaining > 0) return remaining;
  const backoff = DEFAULT_BACKOFF_MS[Math.min(state.attempt, DEFAULT_BACKOFF_MS.length - 1)];
  return backoff;
}

export async function pollWithBackoff(
  fetchReport: () => Promise<ReportPresentationPayload>,
  options: {
    pollAfterMs: number;
    maxWaitMs: number;
    onProgress?: (report: ReportPresentationPayload) => void;
    signal?: AbortSignal;
  }
): Promise<ReportPresentationPayload> {
  const { pollAfterMs, maxWaitMs, onProgress, signal } = options;
  const state = {
    attempt: 0,
    startTime: Date.now(),
    report: null as ReportPresentationPayload | null,
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
      await new Promise<void>((resolve, reject) => {
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
