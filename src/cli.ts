#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { SEOReportClient } from "./client";
import { RateLimitError, AuthenticationError, ValidationError } from "./errors";

const CONFIG_DIR = join(homedir(), ".config", "sr");
const AUTH_FILE = join(CONFIG_DIR, "auth.json");

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function loadAuth(): { apiKey: string; baseUrl?: string } | null {
  try {
    const raw = readFileSync(AUTH_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveAuth(auth: { apiKey: string; baseUrl?: string }): void {
  ensureConfigDir();
  writeFileSync(AUTH_FILE, JSON.stringify(auth, null, 2), { mode: 0o600 });
}

function getClient(): SEOReportClient {
  const auth = loadAuth();
  if (!auth || !auth.apiKey) {
    console.error("No API key configured. Run: sr login --api-key <key>");
    process.exit(1);
  }
  return new SEOReportClient(auth);
}

function printHelp(): void {
  console.log(`sr — SEOReport CLI

Usage:
  sr login --api-key <key>       Store your API key
  sr preview <url>               Get a score preview
  sr report <url>                Create a full report
  sr report <url> --wait         Create and poll until ready
  sr status <job-id>             Check report status
  sr download <job-id> [format]  Download artifact (pdf|md|txt|json)
  sr --version                   Show version
  sr --help                      Show this help

Environment:
  SEOREPORT_API_KEY              Override stored API key
  SEOREPORT_BASE_URL             Override default base URL
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    process.exit(0);
  }

  if (command === "--version" || command === "-v") {
    console.log("0.1.0");
    process.exit(0);
  }

  if (command === "login") {
    const apiKeyFlag = args.find((a) => a.startsWith("--api-key="));
    const apiKey = apiKeyFlag ? apiKeyFlag.slice(10) : args[args.indexOf("--api-key") + 1];
    if (!apiKey) {
      console.error("Usage: sr login --api-key <key>");
      process.exit(1);
    }
    const baseUrl = process.env.SEOREPORT_BASE_URL;
    saveAuth({ apiKey, baseUrl });
    console.log("API key saved.");
    process.exit(0);
  }

  if (command === "preview") {
    const url = args[1];
    if (!url) {
      console.error("Usage: sr preview <url>");
      process.exit(1);
    }
    const client = getClient();
    try {
      const result = await client.createPreview(url);
      if (!result.success) {
        console.error("Error:", result.error);
        if (result.gate) {
          console.error(`Limit: ${result.gate.used}/${result.gate.limit}`);
        }
        process.exit(1);
      }
      console.log(JSON.stringify(result.preview, null, 2));
    } catch (error) {
      handleCliError(error);
    }
    process.exit(0);
  }

  if (command === "report") {
    const url = args[1];
    if (!url) {
      console.error("Usage: sr report <url> [--wait]");
      process.exit(1);
    }
    const wait = args.includes("--wait");
    const client = getClient();
    try {
      if (wait) {
        const report = await client.createAndPoll(url, {}, { maxWaitMs: 60_000 });
        console.log(JSON.stringify(report, null, 2));
      } else {
        const submit = await client.createReport(url);
        if (!submit.success) {
          console.error("Error:", submit.error);
          process.exit(1);
        }
        console.log(JSON.stringify(submit, null, 2));
      }
    } catch (error) {
      handleCliError(error);
    }
    process.exit(0);
  }

  if (command === "status") {
    const jobId = args[1];
    if (!jobId) {
      console.error("Usage: sr status <job-id>");
      process.exit(1);
    }
    const client = getClient();
    try {
      const report = await client.getReport(jobId);
      console.log(JSON.stringify(report, null, 2));
    } catch (error) {
      handleCliError(error);
    }
    process.exit(0);
  }

  if (command === "download") {
    const jobId = args[1];
    const format = (args[2] || "pdf") as "pdf" | "md" | "txt" | "json";
    if (!jobId) {
      console.error("Usage: sr download <job-id> [format]");
      process.exit(1);
    }
    const client = getClient();
    try {
      const blob = await client.downloadArtifact(jobId, format);
      const buffer = Buffer.from(await blob.arrayBuffer());
      process.stdout.write(buffer);
    } catch (error) {
      handleCliError(error);
    }
    process.exit(0);
  }

  console.error(`Unknown command: ${command}`);
  console.error("Run 'sr --help' for usage.");
  process.exit(1);
}

function handleCliError(error: unknown): void {
  if (error instanceof RateLimitError) {
    console.error("Rate limit exceeded:", error.message);
    console.error("Retry after:", error.rateLimit.retryAfterSeconds, "seconds");
  } else if (error instanceof AuthenticationError) {
    console.error("Authentication failed:", error.message);
  } else if (error instanceof ValidationError) {
    console.error("Validation error:", error.message);
  } else if (error instanceof Error) {
    console.error("Error:", error.message);
  } else {
    console.error("Unknown error:", error);
  }
  process.exit(1);
}

main();
