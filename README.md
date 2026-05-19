# @seoreport/client

Official SEOReport client — TypeScript SDK and CLI for the SEOReport REST API.

## Install

```bash
npm install @seoreport/client
```

## Get an API key

Get your free API key at [seoreport.dev](https://seoreport.dev). One signup, no credit card required. Start running reports immediately and upgrade when you need more.

## SDK Usage

```ts
import { SEOReportClient } from "@seoreport/client";

const client = new SEOReportClient({ apiKey: "sr_live_xxxxxxxx" });

// Score preview — quick score + domain breakdown
const preview = await client.createPreview("https://example.com");
console.log(preview.preview.score);

// Full report — create and poll until ready
const report = await client.createAndPoll("https://example.com");
console.log(report.score.overall);

// Download artifact (pdf, md, txt, or json)
const blob = await client.downloadArtifact(jobId, "json");
```

See [seoreport.dev/developers](https://seoreport.dev/developers) for the full integration guide.

## CLI Usage

Install globally:

```bash
npm install -g @seoreport/client
```

```bash
# Authenticate
sr login --api-key sr_live_xxxxxxxx

# Score preview
sr preview https://example.com

# Full report
sr report https://example.com --wait

# Download artifact
sr download <job-id> json
```

## Error Handling

```ts
import { RateLimitError, AuthenticationError } from "@seoreport/client";

try {
  await client.createPreview(url);
} catch (err) {
  if (err instanceof RateLimitError) {
    console.log("Retry after:", err.rateLimit.retryAfterSeconds);
  }
  if (err instanceof AuthenticationError) {
    console.log("Check your API key.");
  }
}
```

## License

MIT
