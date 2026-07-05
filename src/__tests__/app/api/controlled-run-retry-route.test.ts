import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { POST } from "@/app/api/runtime/executor/controlled-runs/[runId]/retry/route";
import {
  createControlledExecutionRun,
  updateControlledExecutionRun,
  updateControlledExecutionStep,
} from "@/lib/server/controlled-execution-store";

let tmpDir: string;
let originalCwd: () => string;
let originalApiToken: string | undefined;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "controlled-retry-route-test-"));
  originalCwd = process.cwd;
  originalApiToken = process.env.AGENTCORE_API_AUTH_TOKEN;
  process.cwd = () => tmpDir;
  delete process.env.AGENTCORE_API_AUTH_TOKEN;
  const jsonStore = await import("@/lib/server/json-store");
  jsonStore.invalidateCache();
});

afterEach(async () => {
  process.cwd = originalCwd;
  if (originalApiToken === undefined) {
    delete process.env.AGENTCORE_API_AUTH_TOKEN;
  } else {
    process.env.AGENTCORE_API_AUTH_TOKEN = originalApiToken;
  }
  await rm(tmpDir, { recursive: true, force: true });
});

async function seedFailedRun(input: { id: string; retryable: boolean }) {
  await createControlledExecutionRun({
    id: input.id,
    requestId: input.id,
    sessionId: "session-1",
    playbookId: "sales-pipeline-v1",
    playbookVersion: "1.0.0",
    plan: {
      id: `plan-${input.id}`,
      goal: "route retry",
      totalSteps: 1,
      requiresApproval: false,
      steps: [
        {
          id: "route_retry_step",
          title: "Route retry step",
          description: "Retry from route",
          toolCalls: [],
          dependsOn: [],
          mode: "auto",
          onFailure: input.retryable ? { action: "retry", maxRetries: 1 } : { action: "fail_run" },
        },
      ],
    },
  });
  await updateControlledExecutionStep(input.id, "route_retry_step", {
    state: "failed",
    error: "route failure",
    toolCallResults: [],
  });
  await updateControlledExecutionRun(input.id, {
    state: "failed",
    currentStepId: "route_retry_step",
    error: "route failure",
  });
}

describe("controlled run retry route", () => {
  it("returns 404 for a missing controlled run", async () => {
    const response = await POST(
      new Request("http://localhost/api/runtime/executor/controlled-runs/missing/retry"),
      { params: Promise.resolve({ runId: "missing" }) },
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.ok).toBe(false);
    expect(data.error).toBe("Controlled run not found");
  });

  it("returns 409 for non-retryable failed runs", async () => {
    await seedFailedRun({ id: "route-non-retryable", retryable: false });

    const response = await POST(
      new Request(
        "http://localhost/api/runtime/executor/controlled-runs/route-non-retryable/retry",
      ),
      { params: Promise.resolve({ runId: "route-non-retryable" }) },
    );
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.ok).toBe(false);
    expect(data.error).toBe("Failed step route_retry_step is not retryable");
  });

  it("returns the updated run and retried step ids", async () => {
    await seedFailedRun({ id: "route-retryable", retryable: true });

    const response = await POST(
      new Request("http://localhost/api/runtime/executor/controlled-runs/route-retryable/retry"),
      { params: Promise.resolve({ runId: "route-retryable" }) },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.data.state).toBe("completed");
    expect(data.data.retriedStepIds).toEqual(["route_retry_step"]);
    expect(data.data.run.auditEvents).toEqual([
      expect.objectContaining({
        type: "console_retry_requested",
        stepId: "route_retry_step",
      }),
    ]);
  });
});
