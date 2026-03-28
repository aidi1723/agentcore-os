import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..", "..");

function moduleUrl(relativePath) {
  return pathToFileURL(path.join(PROJECT_ROOT, relativePath)).href;
}

function logSection(title) {
  console.log(`\n[publish-regression] ${title}`);
}

async function runPublishConfigRegression() {
  logSection("publish config route + store");
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "agentcore-publish-config-"));
  const previousCwd = process.cwd();
  process.chdir(tempRoot);

  try {
    const configRoute = await import(moduleUrl("src/app/api/publish/config/route.ts"));

    const emptyResponse = await configRoute.GET();
    const emptyPayload = await emptyResponse.json();
    assert.equal(emptyResponse.status, 200, "Publish config GET should succeed.");
    assert.equal(emptyPayload.ok, true, "Publish config GET should return ok=true.");
    assert.equal(
      emptyPayload.data?.matrixAccounts?.xiaohongshu?.token,
      "",
      "Publish config should default missing platform tokens to empty strings.",
    );

    const updateResponse = await configRoute.PUT(
      new Request("http://localhost/api/publish/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matrixAccounts: {
            xiaohongshu: {
              token: "publish-token",
              webhookUrl: "http://127.0.0.1:8787/webhook/publish",
            },
            instagram: {
              token: "ig-token",
            },
          },
        }),
      }),
    );
    const updatePayload = await updateResponse.json();
    assert.equal(updateResponse.status, 200, "Publish config PUT should succeed.");
    assert.equal(updatePayload.ok, true, "Publish config PUT should return ok=true.");
    assert.equal(
      updatePayload.data?.matrixAccounts?.xiaohongshu?.token,
      "publish-token",
      "Publish config PUT should persist explicit token values.",
    );
    assert.equal(
      updatePayload.data?.matrixAccounts?.instagram?.webhookUrl,
      "",
      "Publish config normalization should fill missing webhookUrl values.",
    );

    const reloadedResponse = await configRoute.GET();
    const reloadedPayload = await reloadedResponse.json();
    assert.equal(
      reloadedPayload.data?.matrixAccounts?.xiaohongshu?.webhookUrl,
      "http://127.0.0.1:8787/webhook/publish",
      "Publish config GET should read back persisted webhook URLs.",
    );
    assert.equal(
      reloadedPayload.data?.matrixAccounts?.linkedin?.token,
      "",
      "Publish config normalization should preserve defaults for untouched platforms.",
    );

    console.log("publish config route + store regression passed");
  } finally {
    process.chdir(previousCwd);
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function runPublishDispatchReceiptRegression() {
  logSection("publish dispatch receipt semantics");
  const originalFetch = globalThis.fetch;
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "agentcore-publish-dispatch-"));
  const previousCwd = process.cwd();
  process.chdir(tempRoot);

  globalThis.fetch = async (input) => {
    const url = typeof input === "string" ? input : String(input?.url ?? "");

    if (url === "http://127.0.0.1:8787/dispatch-ok") {
      return new Response(
        JSON.stringify({
          ok: true,
          id: "receipt-123",
          externalId: "provider-job-1",
          queued: true,
          retryable: true,
          receivedAt: "2026-03-28T00:00:00.000Z",
          message: "Queued by connector",
        }),
        { status: 202, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url === "http://127.0.0.1:8787/dispatch-auth-error") {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Connector token rejected",
          errorType: "auth",
          retryable: false,
          receivedAt: "2026-03-28T00:01:00.000Z",
          message: "Refresh credentials",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    throw new Error(`unexpected fetch url: ${url}`);
  };

  try {
    const publishDispatch = await import(moduleUrl("src/lib/server/publish-dispatch.ts"));
    const publishJobStore = await import(moduleUrl("src/lib/server/publish-job-store.ts"));

    const dispatchResult = await publishDispatch.runPublishDispatch({
      title: "Receipt regression title",
      body: "Receipt regression body for webhook + manual connector flows.",
      platforms: ["xiaohongshu", "douyin", "wechat"],
      dryRun: false,
      timeoutSeconds: 0,
      connections: {
        xiaohongshu: {
          token: "connector-token",
          webhookUrl: "http://127.0.0.1:8787/dispatch-ok",
        },
        douyin: {
          token: "expired-token",
          webhookUrl: "http://127.0.0.1:8787/dispatch-auth-error",
        },
      },
    });

    assert.equal(dispatchResult.ok, false, "Mixed connector results should return ok=false.");
    assert.equal(
      Array.isArray(dispatchResult.results),
      true,
      "Dispatch mode should expose per-platform structured results.",
    );

    const receiptResult = dispatchResult.results.find((item) => item.platform === "xiaohongshu");
    assert.equal(receiptResult?.ok, true, "Successful webhook result should remain ok=true.");
    assert.equal(receiptResult?.status, 202, "Structured receipt should preserve HTTP status.");
    assert.equal(receiptResult?.queued, true, "Structured receipt should preserve queued=true.");
    assert.equal(receiptResult?.retryable, true, "Structured receipt should preserve retryable=true.");
    assert.equal(receiptResult?.receiptId, "receipt-123", "Structured receipt should map id -> receiptId.");
    assert.equal(
      receiptResult?.externalId,
      "provider-job-1",
      "Structured receipt should preserve externalId.",
    );
    assert.equal(
      receiptResult?.message,
      "Queued by connector",
      "Structured receipt should preserve connector message.",
    );

    const authErrorResult = dispatchResult.results.find((item) => item.platform === "douyin");
    assert.equal(authErrorResult?.ok, false, "Connector auth failures should remain ok=false.");
    assert.equal(authErrorResult?.status, 401, "Connector auth failures should preserve HTTP status.");
    assert.equal(authErrorResult?.retryable, false, "Connector auth failures should preserve retryable=false.");
    assert.equal(authErrorResult?.errorType, "auth", "Connector auth failures should preserve errorType.");
    assert.equal(
      authErrorResult?.error,
      "Connector token rejected",
      "Connector auth failures should preserve machine-readable error text.",
    );

    const manualResult = dispatchResult.results.find((item) => item.platform === "wechat");
    assert.equal(manualResult?.mode, "manual", "Platforms without webhook should remain manual.");
    assert.equal(manualResult?.queued, false, "Manual results should explicitly report queued=false.");
    assert.equal(
      manualResult?.message,
      "未配置 Webhook，已返回手动发布清单。",
      "Manual results should preserve operator-facing fallback guidance.",
    );

    const job = await publishJobStore.createPublishJobRecord({
      draftTitle: "Receipt persistence regression",
      draftBody: "Persist structured connector receipt fields.",
      platforms: ["xiaohongshu", "douyin", "wechat"],
      mode: "dispatch",
    });
    await publishJobStore.updatePublishJobRecord(job.id, {
      status: "error",
      resultText: "Dispatch result persisted",
      results: dispatchResult.results,
    });

    const storedJob = (await publishJobStore.listPublishJobs()).find((item) => item.id === job.id);
    const storedReceipt = storedJob?.results?.find((item) => item.platform === "xiaohongshu");
    const storedError = storedJob?.results?.find((item) => item.platform === "douyin");
    const storedManual = storedJob?.results?.find((item) => item.platform === "wechat");

    assert.equal(storedReceipt?.receiptId, "receipt-123", "Store should persist receiptId.");
    assert.equal(storedReceipt?.receivedAt, "2026-03-28T00:00:00.000Z", "Store should persist receivedAt.");
    assert.equal(storedError?.errorType, "auth", "Store should persist errorType.");
    assert.equal(storedError?.retryable, false, "Store should persist retryable=false.");
    assert.equal(storedManual?.queued, false, "Store should persist manual queued=false.");

    console.log("publish dispatch receipt regression passed");
  } finally {
    globalThis.fetch = originalFetch;
    process.chdir(previousCwd);
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function runPublishQueueRegression() {
  logSection("publish queue lifecycle");
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "agentcore-publish-regression-"));
  const previousCwd = process.cwd();
  process.chdir(tempRoot);

  try {
    const publishJobStore = await import(moduleUrl("src/lib/server/publish-job-store.ts"));
    const publishConfigStore = await import(moduleUrl("src/lib/server/publish-config-store.ts"));
    const queueRunner = await import(moduleUrl("src/lib/server/publish-queue-runner.ts"));

    await publishConfigStore.writePublishConfig({});

    const stoppedJob = await publishJobStore.createPublishJobRecord({
      draftTitle: "Stopped queue regression",
      draftBody: "This job should never be claimed while stopped.",
      platforms: ["xiaohongshu"],
      mode: "dispatch",
    });

    await publishJobStore.updatePublishJobRecord(stoppedJob.id, {
      status: "stopped",
      nextAttemptAt: Date.now() - 1000,
    });

    const stoppedRun = await queueRunner.runOneQueuedPublishJob();
    assert.equal(
      stoppedRun.processed,
      false,
      "Stopped jobs should not be claimed by the queue runner.",
    );

    const dryRunJob = await publishJobStore.createPublishJobRecord({
      draftTitle: "Regression dry run",
      draftBody: "Regression body for dry-run publishing",
      platforms: ["wechat", "xiaohongshu"],
      mode: "dry-run",
    });

    const dryRunResult = await queueRunner.runOneQueuedPublishJob();
    assert.equal(dryRunResult.ok, true, "Dry-run publish queue execution should succeed.");
    assert.equal(dryRunResult.processed, true, "Dry-run publish queue should process one job.");

    const jobsAfterDryRun = await publishJobStore.listPublishJobs();
    const finishedDryRun = jobsAfterDryRun.find((job) => job.id === dryRunJob.id);
    assert.equal(finishedDryRun?.status, "done", "Dry-run publish job should finish as done.");
    assert.ok(finishedDryRun?.resultText, "Dry-run publish job should store result text.");

    await publishConfigStore.writePublishConfig({
      xiaohongshu: {
        token: "regression-token",
        webhookUrl: "http://127.0.0.1:9/dispatch",
      },
    });

    const dispatchJob = await publishJobStore.createPublishJobRecord({
      draftTitle: "Dispatch retry regression",
      draftBody: "This should retry and then fail.",
      platforms: ["xiaohongshu"],
      mode: "dispatch",
      maxAttempts: 2,
    });

    const firstDispatch = await queueRunner.runOneQueuedPublishJob();
    assert.equal(firstDispatch.ok, false, "First dispatch attempt should fail.");
    assert.equal(firstDispatch.retried, true, "First dispatch attempt should schedule a retry.");

    const afterFirstFailure = (await publishJobStore.listPublishJobs()).find(
      (job) => job.id === dispatchJob.id,
    );
    assert.equal(
      afterFirstFailure?.status,
      "queued",
      "Retryable dispatch failures should return to queued state.",
    );
    assert.equal(afterFirstFailure?.attempts, 1, "First dispatch failure should record one attempt.");
    assert.ok(
      typeof afterFirstFailure?.nextAttemptAt === "number" &&
        afterFirstFailure.nextAttemptAt > Date.now(),
      "Retryable dispatch failures should schedule the next attempt in the future.",
    );
    assert.ok(
      (afterFirstFailure?.nextAttemptAt ?? 0) - Date.now() <= 60_000,
      "Retry backoff should remain capped at 60 seconds.",
    );

    await publishJobStore.updatePublishJobRecord(dispatchJob.id, {
      nextAttemptAt: Date.now() - 1000,
    });

    const secondDispatch = await queueRunner.runOneQueuedPublishJob();
    assert.equal(secondDispatch.ok, false, "Second dispatch attempt should still fail.");
    assert.equal(
      secondDispatch.retried,
      undefined,
      "Final dispatch failure should not schedule another retry.",
    );

    const jobsAfterDispatch = await publishJobStore.listPublishJobs();
    const failedDispatch = jobsAfterDispatch.find((job) => job.id === dispatchJob.id);
    assert.equal(
      failedDispatch?.status,
      "error",
      "Dispatch job should end in error after max attempts.",
    );
    assert.equal(failedDispatch?.attempts, 2, "Dispatch job should record both attempts.");
    assert.equal(
      failedDispatch?.nextAttemptAt,
      undefined,
      "Final dispatch failure should clear nextAttemptAt.",
    );

    const lockFile = path.join(tempRoot, ".openclaw-data", "publish-queue.lock");
    assert(!fs.existsSync(lockFile), "Publish queue lock should be released after processing.");

    console.log("publish queue lifecycle regression passed");
  } finally {
    process.chdir(previousCwd);
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function runConnectorProxyRegression() {
  logSection("connector proxy routes");
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const url = typeof input === "string" ? input : String(input?.url ?? "");

    if (url === "http://127.0.0.1:8787/health") {
      return new Response(
        JSON.stringify({
          ok: true,
          name: "agentcore-os-webhook-connector",
          version: "1.0.0",
          time: "2026-03-28T00:00:00.000Z",
          capabilities: {
            publishWebhook: true,
            receiptListing: true,
            dryRun: true,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url === "http://127.0.0.1:8787/jobs?limit=7") {
      return new Response(
        JSON.stringify({
          ok: true,
          jobs: [
            {
              id: "receipt-1",
              platform: "xiaohongshu",
              receivedAt: "2026-03-28T00:00:00.000Z",
              queued: true,
              retryable: true,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ ok: false, error: "unexpected url" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const healthRoute = await import(moduleUrl("src/app/api/publish/connector/health/route.ts"));
    const jobsRoute = await import(moduleUrl("src/app/api/publish/connector/jobs/route.ts"));

    const healthResponse = await healthRoute.GET();
    const healthPayload = await healthResponse.json();
    assert.equal(healthResponse.status, 200, "Connector health proxy should return 200 on success.");
    assert.equal(healthPayload.ok, true, "Connector health proxy should preserve success.");
    assert.equal(
      healthPayload.health?.capabilities?.publishWebhook,
      true,
      "Connector health proxy should surface connector capabilities.",
    );

    const jobsResponse = await jobsRoute.GET(
      new Request("http://localhost/api/publish/connector/jobs?limit=7"),
    );
    const jobsPayload = await jobsResponse.json();
    assert.equal(jobsResponse.status, 200, "Connector jobs proxy should return 200 on success.");
    assert.equal(jobsPayload.ok, true, "Connector jobs proxy should preserve success.");
    assert.equal(
      Array.isArray(jobsPayload.data?.jobs),
      true,
      "Connector jobs proxy should expose the connector receipt list under data.jobs.",
    );
    assert.equal(
      jobsPayload.data.jobs[0]?.queued,
      true,
      "Connector jobs proxy should preserve machine-readable receipt fields.",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log("connector proxy regression passed");
}

async function runQueueRouteRegression() {
  logSection("publish queue route auth surface");
  const previousSecret = process.env.OPENCLAW_QUEUE_SECRET;
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "agentcore-publish-route-"));
  const previousCwd = process.cwd();
  process.chdir(tempRoot);

  try {
    const queueRoute = await import(moduleUrl("src/app/api/publish/queue/run/route.ts"));

    delete process.env.OPENCLAW_QUEUE_SECRET;
    const openResponse = await queueRoute.GET();
    const openPayload = await openResponse.json();
    assert.equal(
      openPayload.data?.authRequired,
      false,
      "Queue route should report authRequired=false when no secret is configured.",
    );

    process.env.OPENCLAW_QUEUE_SECRET = "regression-secret";
    const lockedResponse = await queueRoute.GET();
    const lockedPayload = await lockedResponse.json();
    assert.equal(
      lockedPayload.data?.authRequired,
      true,
      "Queue route should report authRequired=true when a secret is configured.",
    );

    const unauthorized = await queueRoute.POST(
      new Request("http://localhost/api/publish/queue/run", {
        method: "POST",
      }),
    );
    const unauthorizedPayload = await unauthorized.json();
    assert.equal(unauthorized.status, 401, "Unauthorized queue POST should be rejected.");
    assert.equal(unauthorizedPayload.ok, false, "Unauthorized queue POST should fail cleanly.");

    const authorized = await queueRoute.POST(
      new Request("http://localhost/api/publish/queue/run", {
        method: "POST",
        headers: {
          authorization: "Bearer regression-secret",
        },
      }),
    );
    const authorizedPayload = await authorized.json();
    assert.equal(authorized.status, 200, "Authorized queue POST should succeed.");
    assert.equal(
      authorizedPayload.ok,
      true,
      "Authorized queue POST should return the queue runner result envelope.",
    );
  } finally {
    process.chdir(previousCwd);
    await rm(tempRoot, { recursive: true, force: true });
    if (previousSecret === undefined) {
      delete process.env.OPENCLAW_QUEUE_SECRET;
    } else {
      process.env.OPENCLAW_QUEUE_SECRET = previousSecret;
    }
  }

  console.log("publish queue route auth regression passed");
}

async function main() {
  await runPublishConfigRegression();
  await runPublishDispatchReceiptRegression();
  await runPublishQueueRegression();
  await runConnectorProxyRegression();
  await runQueueRouteRegression();
  console.log("\n[publish-regression] all publish regressions passed");
}

main().catch((error) => {
  console.error("\n[publish-regression] failed");
  console.error(error);
  process.exitCode = 1;
});
